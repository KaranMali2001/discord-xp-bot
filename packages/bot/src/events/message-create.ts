import { xpService } from '@xp/core'
import { type Client, Events } from 'discord.js'
import { log } from '../lib/log'
import { processGrant } from '../lib/rewards'

/** Chat XP: lowest-value activity. Cooldown + no-XP channels are enforced in core. */
export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (msg) => {
    // grantMessage hits the sync DB surface on EVERY message — an unguarded async
    // listener turns a transient throw into an unhandledRejection. Log + return,
    // never let it reject (Phase 0). Modeled on interaction-create.ts.
    try {
      if (msg.author.bot || !msg.inGuild()) return
      const name = msg.member?.displayName ?? msg.author.username
      const channel = 'name' in msg.channel ? `#${msg.channel.name}` : msg.channelId

      const outcome = await xpService.grantMessage(msg.guild.id, msg.author.id, name, msg.channelId)

      if ('skip' in outcome) {
        log.debug('chat', `${name} in ${channel} → skipped (${outcome.skip})`)
        return
      }
      log.info(
        'chat',
        `${name} +${outcome.result.awarded}xp → ${outcome.result.member.xp} (L${outcome.result.newLevel}) in ${channel}`,
      )
      if (outcome.result.leveledUp || outcome.result.awarded > 0) {
        await processGrant(msg.guild.id, msg.author.id, outcome.result, msg.channelId)
      }
    } catch (err) {
      log.error('chat', `message handler failed: ${err}`)
    }
  })
}
