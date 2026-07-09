import { xpService } from '@xp/core'
import { type Client, Events } from 'discord.js'
import { log } from '../lib/log'
import { processGrant } from '../lib/rewards'

/** Chat XP: lowest-value activity. Cooldown + no-XP channels are enforced in core. */
export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.inGuild()) return
    const name = msg.member?.displayName ?? msg.author.username
    const channel = 'name' in msg.channel ? `#${msg.channel.name}` : msg.channelId

    const outcome = xpService.grantMessage(msg.guild.id, msg.author.id, name, msg.channelId)

    if ('skip' in outcome) {
      log.debug('chat', `${name} in ${channel} → skipped (${outcome.skip})`)
      return
    }
    log.info(
      'chat',
      `${name} +${outcome.result.awarded}xp → ${outcome.result.member.xp} (L${outcome.result.newLevel}) in ${channel}`,
    )
    if (outcome.result.leveledUp || outcome.result.awarded > 0) {
      await processGrant(client, msg.guild.id, msg.author.id, outcome.result, msg.channelId)
    }
  })
}
