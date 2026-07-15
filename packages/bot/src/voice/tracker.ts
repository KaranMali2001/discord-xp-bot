import { randomUUID } from 'node:crypto'
import {
  type VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice'
import { nowSec } from '@xp/core'
import type { VoiceBasedChannel } from 'discord.js'
import { log } from '../lib/log'
import { onSpeakingStart } from './capture'

/** Per-member voice session, held in memory between XP ticks. */
export interface VoiceSession {
  guildId: string
  userId: string
  username: string
  channelId: string
  /** self/server muted or deafened — used with config.ignoreMutedVoice. */
  muted: boolean
  /** set true when the receiver reports this user transmitting audio during the tick. */
  spokeThisTick: boolean
  /** epoch seconds we last billed this member up to. */
  lastAccountedAt: number
}

const sessions = new Map<string, VoiceSession>()
/** One connection per guild (Discord limit). Tracks WHICH channel we're in, plus a
 * per-join `sessionId` so captured utterances can be grouped into one conversation. */
const connections = new Map<
  string,
  { conn: VoiceConnection; channelId: string; sessionId: string }
>()

const key = (guildId: string, userId: string) => `${guildId}:${userId}`

export const tracker = {
  all(): VoiceSession[] {
    return [...sessions.values()]
  },

  upsert(s: Omit<VoiceSession, 'spokeThisTick' | 'lastAccountedAt'>): void {
    const existing = sessions.get(key(s.guildId, s.userId))
    if (existing) {
      existing.channelId = s.channelId
      existing.username = s.username
      existing.muted = s.muted
    } else {
      sessions.set(key(s.guildId, s.userId), {
        ...s,
        spokeThisTick: false,
        lastAccountedAt: nowSec(),
      })
    }
  },

  remove(guildId: string, userId: string): void {
    sessions.delete(key(guildId, userId))
  },

  markSpoke(guildId: string, userId: string): void {
    const s = sessions.get(key(guildId, userId))
    if (s) s.spokeThisTick = true
  },

  guildsWithSessions(): string[] {
    return [...new Set([...sessions.values()].map((s) => s.guildId))]
  },

  channelsWithMembers(guildId: string): string[] {
    return [
      ...new Set(
        [...sessions.values()].filter((s) => s.guildId === guildId).map((s) => s.channelId),
      ),
    ]
  },

  countInChannel(guildId: string, channelId: string): number {
    return [...sessions.values()].filter((s) => s.guildId === guildId && s.channelId === channelId)
      .length
  },

  connectedChannelId(guildId: string): string | undefined {
    return connections.get(guildId)?.channelId
  },

  /**
   * Join `channel` so the receiver emits speaking events. Called by the tick's
   * reconcile step when an event is active on that channel OR a manual dashboard capture
   * targets it — the bot is never in voice otherwise. Switches channels if already
   * connected elsewhere in the guild.
   */
  connectTo(channel: VoiceBasedChannel): void {
    const existing = connections.get(channel.guild.id)
    if (existing?.channelId === channel.id) return
    if (existing) existing.conn.destroy()

    // New capture window: every utterance recorded on this connection shares this id.
    const sessionId = randomUUID()

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false, // must not be deaf to receive audio / speaking events
      selfMute: true, // we never transmit
    })

    // Diagnostic: log every state transition so a stuck handshake is visible.
    conn.on('stateChange', (o, n) => log.info('voice', `connection: ${o.status} → ${n.status}`))
    // Speaking events only flow once the UDP + encryption handshake reaches Ready.
    conn.on(VoiceConnectionStatus.Ready, () =>
      log.info('voice', `🎧 voice connection ready in #${channel.name} — receiving audio`),
    )
    entersState(conn, VoiceConnectionStatus.Ready, 15_000).catch(() =>
      log.warn(
        'voice',
        `voice never reached Ready (stuck at "${conn.state.status}") — no audio/speaking; the UDP audio handshake to Discord is likely being blocked`,
      ),
    )
    // A dropped connection must be reconnected or destroyed, else it hangs half-joined.
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5000),
        ])
      } catch {
        log.warn('voice', `lost voice connection in #${channel.name} — leaving`)
        conn.destroy()
      }
    })
    conn.on('error', (e) => log.error('voice', `connection error: ${(e as Error).message}`))

    conn.receiver.speaking.on('start', (userId) => {
      log.debug('voice', `🗣️ speaking: ${userId}`)
      tracker.markSpoke(channel.guild.id, userId)
      // Record this utterance for transcription (no-op unless TRANSCRIPTS_ENABLED).
      onSpeakingStart({
        receiver: conn.receiver,
        guildId: channel.guild.id,
        channelId: channel.id,
        sessionId,
        userId,
        username: channel.guild.members.cache.get(userId)?.displayName ?? userId,
      })
    })
    conn.on(VoiceConnectionStatus.Destroyed, () => {
      if (connections.get(channel.guild.id)?.channelId === channel.id) {
        connections.delete(channel.guild.id)
      }
    })
    connections.set(channel.guild.id, { conn, channelId: channel.id, sessionId })
  },

  disconnect(guildId: string): void {
    const c = connections.get(guildId)
    if (c) {
      c.conn.destroy()
      connections.delete(guildId)
    }
  },

  /** Leave every voice channel — called on shutdown so restarts don't leave a ghost
   * session on Discord (which otherwise wedges the next join in "signalling"). */
  disconnectAll(): void {
    for (const { conn } of connections.values()) {
      try {
        conn.destroy()
      } catch {
        // already destroyed — ignore
      }
    }
    connections.clear()
  },
}
