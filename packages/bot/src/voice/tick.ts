import { env, isEventActive, nowSec, rulesDao, rulesService, voiceService } from '@xp/core'
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
function reconcileConnections(client: Client): void {
  const at = nowSec()
  // Iterate every guild (not just ones with sessions) so a manual capture can join an
  // empty channel and wait, and so capture works even before anyone is tracked.
  for (const guild of client.guilds.cache.values()) {
    const guildId = guild.id

    // Manual dashboard capture wins: join the chosen channel regardless of events/members.
    const manualChannelId = rulesService.getConfig(guildId).voiceCaptureChannelId

    const activeEvents = rulesDao.listEvents(guildId).filter((e) => isEventActive(e, at))
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
 * Runs every XP_TICK_SECONDS. Reconciles voice connections, then bills each member's
 * elapsed voice time at the speaking rate (if they spoke this tick — only possible in
 * the channel the bot joined) or the presence rate. Set XP_TICK_SECONDS=2 locally.
 */
export function startVoiceTick(client: Client): NodeJS.Timeout {
  return setInterval(async () => {
    reconcileConnections(client)

    const now = nowSec()
    for (const s of tracker.all()) {
      const cfg = rulesService.getConfig(s.guildId)
      const elapsed = Math.min(now - s.lastAccountedAt, env.XP_TICK_SECONDS * 2)
      s.lastAccountedAt = now

      const present = !(s.muted && cfg.ignoreMutedVoice)
      const spoke = s.spokeThisTick
      s.spokeThisTick = false

      if (elapsed <= 0 || !present) continue

      const outcome = voiceService.grantTick({
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
  }, env.XP_TICK_SECONDS * 1000)
}
