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
  for (const guildId of tracker.guildsWithSessions()) {
    const guild = client.guilds.cache.get(guildId)
    if (!guild) continue

    const activeEvents = rulesDao.listEvents(guildId).filter((e) => isEventActive(e, at))
    const eligible = tracker
      .channelsWithMembers(guildId)
      .filter((chId) => activeEvents.some((e) => e.channelId == null || e.channelId === chId))
      .sort((a, b) => tracker.countInChannel(guildId, b) - tracker.countInChannel(guildId, a))

    const best = eligible[0]
    const current = tracker.connectedChannelId(guildId)

    if (best) {
      if (current !== best) {
        const ch = guild.channels.cache.get(best)
        if (ch?.isVoiceBased()) {
          tracker.connectTo(ch)
          log.info('voice', `bot joined #${ch.name} — event active, listening for speaking`)
        }
      }
    } else if (current) {
      tracker.disconnect(guildId)
      log.info('voice', 'bot left voice — no active event')
    }
  }
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
        await processGrant(client, s.guildId, s.userId, outcome.result, s.channelId)
      }
    }
  }, env.XP_TICK_SECONDS * 1000)
}
