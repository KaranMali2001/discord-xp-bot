import { env } from '@xp/core'
import { Events } from 'discord.js'
import { createClient } from './client'
import { deployCommands } from './deploy-commands'
import { registerInteractionCreate } from './events/interaction-create'
import { registerMessageCreate } from './events/message-create'
import { registerVoiceStateUpdate } from './events/voice-state-update'
import { log } from './lib/log'
import { startVoiceTick } from './voice/tick'

async function main(): Promise<void> {
  log.info('boot', 'starting bot…')
  const client = createClient()

  registerMessageCreate(client)
  registerVoiceStateUpdate(client)
  registerInteractionCreate(client)
  log.info('boot', 'registered message / voice / interaction handlers')

  client.once(Events.ClientReady, async (c) => {
    log.info('boot', `logged in as ${c.user.tag} — watching ${c.guilds.cache.size} guild(s)`)
    await deployCommands().catch((e) => log.error('boot', `command deploy failed: ${e}`))
    startVoiceTick(client)
    log.info('boot', `voice XP tick every ${env.XP_TICK_SECONDS}s — ready ✅`)
  })

  client.on(Events.Error, (e) => log.error('client', String(e)))
  client.on(Events.Warn, (m) => log.warn('client', m))

  await client.login(env.DISCORD_TOKEN)
}

main().catch((e) => {
  log.error('fatal', String(e))
  process.exit(1)
})
