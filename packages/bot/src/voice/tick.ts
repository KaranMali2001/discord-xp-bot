import { env, isEventActive, nowSec, rulesService, voiceService } from '@xp/core'
import type { Client } from 'discord.js'
import { log } from '../lib/log'
import { processGrant } from '../lib/rewards'
import { tracker } from './tracker'

/**
 * Decide where (if anywhere) the bot should be in voice: join a channel ONLY while an
 * event that applies to it is active and it has members; otherwise leave. With one
 * connection per guild, we pick the eligible channel with the most people. This keeps
 * the bot out of casual voice — it only appears during actual boosted discussions.
 */
async function reconcileConnections(client: Client): Promise<void> {
  const at = nowSec()
  // Iterate every guild (not just ones with sessions) so a manual capture can join an
  // empty channel and wait, and so capture works even before anyone is tracked.
  for (const guild of client.guilds.cache.values()) {
    const guildId = guild.id

    // Manual dashboard capture wins: join the chosen channel regardless of events/members.
    const manualChannelId = (await rulesService.getConfig(guildId)).voiceCaptureChannelId

    const activeEvents = (await rulesService.getEvents(guildId)).filter((e) => isEventActive(e, at))
    const eventChannel = tracker
      .channelsWithMembers(guildId)
      .filter((chId) => activeEvents.some((e) => e.channelId == null || e.channelId === chId))
      .sort((a, b) => tracker.countInChannel(guildId, b) - tracker.countInChannel(guildId, a))[0]

    const best = manualChannelId ?? eventChannel
    const current = tracker.connectedChannelId(guildId)

    if (best) {
      if (current !== best) {
        const ch = guild.channels.cache.get(best)
        if (ch?.isVoiceBased()) {
          tracker.connectTo(ch)
          const reason = manualChannelId ? 'manual capture' : 'event active'
          log.info('voice', `bot joined #${ch.name} — ${reason}, listening for speaking`)
        }
      }
    } else if (current) {
      tracker.disconnect(guildId)
      log.info('voice', 'bot left voice — no active event / capture')
    }
  }
}

/**
 * Seed sessions from members already in voice at startup. No voiceStateUpdate fires for
 * people who were connected before the bot logged in (or before a dev-watch restart), so
 * without this the bot is blind to them until they toggle their voice state.
 */
export function seedVoiceSessions(client: Client): void {
  let seeded = 0
  for (const guild of client.guilds.cache.values()) {
    for (const vs of guild.voiceStates.cache.values()) {
      if (!vs.channelId || !vs.member || vs.member.user.bot) continue
      tracker.upsert({
        guildId: guild.id,
        userId: vs.id,
        username: vs.member.displayName,
        channelId: vs.channelId,
        muted: Boolean(vs.mute || vs.deaf || vs.selfMute || vs.selfDeaf),
      })
      seeded++
    }
  }
  if (seeded > 0) log.info('voice', `seeded ${seeded} member(s) already in voice`)
}

/**
 * Voice connections are reconciled on their own fast loop so dashboard capture
 * start/stop (and event windows) take effect promptly — independent of the XP bill
 * interval, which is often long in prod (XP_TICK_SECONDS=60). Without this, "Stop
 * capture" could leave the bot in voice for up to a full XP tick.
 */
const RECONCILE_INTERVAL_MS = 5_000

/**
 * Starts two loops:
 *  - reconcile (every ~5s, or the XP tick if shorter): keep the bot's voice presence
 *    in sync with capture/events quickly.
 *  - bill (every XP_TICK_SECONDS): award each member's elapsed voice time at the
 *    speaking rate (if they spoke this tick) or the presence rate.
 * Set XP_TICK_SECONDS=2 locally.
 */
export function startVoiceTick(client: Client): void {
  // Reconcile immediately, then on a short interval — never slower than the bill tick.
  void reconcileConnections(client).catch((e) =>
    log.error('voice', `initial reconcile failed: ${e}`),
  )
  const reconcileMs = Math.min(RECONCILE_INTERVAL_MS, env.XP_TICK_SECONDS * 1000)
  // Never let a transient DB throw escape the timer — that becomes an uncaught
  // exception and kills the process (the 130-restart incident). Log + skip the tick.
  setInterval(() => {
    void reconcileConnections(client).catch((e) =>
      log.error('voice', `reconcile tick failed — skipping: ${e}`),
    )
  }, reconcileMs)

  setInterval(async () => {
    try {
      const now = nowSec()
      for (const s of tracker.all()) {
        const cfg = await rulesService.getConfig(s.guildId)
        const elapsed = Math.min(now - s.lastAccountedAt, env.XP_TICK_SECONDS * 2)
        s.lastAccountedAt = now

        const present = !(s.muted && cfg.ignoreMutedVoice)
        const spoke = s.spokeThisTick
        s.spokeThisTick = false

        if (elapsed <= 0) continue

        // Record per-event attendance DURATION every tick — including muted ticks that the
        // XP grant below skips — so the dashboard can report muted vs unmuted vs talk time.
        // MUST be awaited: a floating promise here silently drops attendance duration and
        // races the next tick's s.lastAccountedAt (the highest data-loss risk in the migration).
        await voiceService.recordDuration({
          guildId: s.guildId,
          userId: s.userId,
          username: s.username,
          channelId: s.channelId,
          seconds: elapsed,
          muted: s.muted,
          spoke,
        })

        if (!present) continue

        const outcome = await voiceService.grantTick({
          guildId: s.guildId,
          userId: s.userId,
          username: s.username,
          channelId: s.channelId,
          presentSeconds: elapsed,
          spoke,
        })

        if ('result' in outcome && outcome.result.awarded > 0) {
          log.debug(
            'voice',
            `${s.username} +${outcome.result.awarded}xp (spoke=${spoke}) → ${outcome.result.member.xp}`,
          )
          await processGrant(s.guildId, s.userId, outcome.result, s.channelId)
        }
      }
    } catch (e) {
      log.error('voice', `bill tick failed — skipping: ${e}`)
    }
  }, env.XP_TICK_SECONDS * 1000)
}
