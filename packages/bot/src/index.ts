import { env } from '@xp/core'
import { Events } from 'discord.js'
import { createClient } from './client'
import { deployCommands } from './deploy-commands'
import { registerInteractionCreate } from './events/interaction-create'
import { registerMessageCreate } from './events/message-create'
import { registerVoiceStateUpdate } from './events/voice-state-update'
import { startAnnouncementTick, sweepMissedAnnouncements } from './features/scheduled-tick'
import { handleThreadMessage } from './features/tickets'
import { log } from './lib/log'
import { seedVoiceSessions, startVoiceTick } from './voice/tick'
import { tracker } from './voice/tracker'

async function main(): Promise<void> {
  log.info('boot', 'starting bot…')
  const client = createClient()

  registerMessageCreate(client)
  registerVoiceStateUpdate(client)
  registerInteractionCreate(client)
  // Guard ticket threads: let staff pull a 3rd person in via @mention; block everyone else.
  client.on(Events.MessageCreate, (m) => {
    void handleThreadMessage(m).catch((e) => log.error('tickets', `thread guard: ${e}`))
  })
  log.info('boot', 'registered message / voice / interaction handlers')

  client.once(Events.ClientReady, async (c) => {
    log.info('boot', `logged in as ${c.user.tag} — watching ${c.guilds.cache.size} guild(s)`)
    await deployCommands().catch((e) => log.error('boot', `command deploy failed: ${e}`))
    seedVoiceSessions(client)
    startVoiceTick(client)
    sweepMissedAnnouncements()
    startAnnouncementTick()
    log.info('boot', `voice XP tick every ${env.XP_TICK_SECONDS}s — ready ✅`)
  })

  client.on(Events.Error, (e) => log.error('client', String(e)))
  client.on(Events.Warn, (m) => log.warn('client', m))

  // Leave voice + close the gateway before exit (tsx-watch sends SIGTERM on reload) so
  // Discord doesn't keep a ghost voice session that wedges the next join in "signalling".
  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    log.info('boot', 'shutting down — leaving voice')
    tracker.disconnectAll()
    void client.destroy()
    setTimeout(() => process.exit(0), 250)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  await client.login(env.DISCORD_TOKEN)
}

main().catch((e) => {
  log.error('fatal', String(e))
  process.exit(1)
})
