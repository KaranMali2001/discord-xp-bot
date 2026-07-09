import { type VoiceConnection, VoiceConnectionStatus, joinVoiceChannel } from '@discordjs/voice'
import { nowSec } from '@xp/core'
import type { VoiceBasedChannel } from 'discord.js'

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
/** One connection per guild (Discord limit). Tracks WHICH channel we're in. */
const connections = new Map<string, { conn: VoiceConnection; channelId: string }>()

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
   * reconcile step ONLY while an event is active on that channel — the bot is never
   * in voice otherwise. Switches channels if already connected elsewhere in the guild.
   */
  connectTo(channel: VoiceBasedChannel): void {
    const existing = connections.get(channel.guild.id)
    if (existing?.channelId === channel.id) return
    if (existing) existing.conn.destroy()

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false, // must not be deaf to receive audio / speaking events
      selfMute: true, // we never transmit
    })
    conn.receiver.speaking.on('start', (userId) => tracker.markSpoke(channel.guild.id, userId))
    conn.on(VoiceConnectionStatus.Destroyed, () => {
      if (connections.get(channel.guild.id)?.channelId === channel.id) {
        connections.delete(channel.guild.id)
      }
    })
    connections.set(channel.guild.id, { conn, channelId: channel.id })
  },

  disconnect(guildId: string): void {
    const c = connections.get(guildId)
    if (c) {
      c.conn.destroy()
      connections.delete(guildId)
    }
  },
}
