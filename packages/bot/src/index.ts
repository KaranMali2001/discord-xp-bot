import type { Server } from 'node:http'
import { env, installCrashHandlers, rulesService } from '@xp/core'
import { Events } from 'discord.js'
import { createClient } from './client'
import { deployCommands } from './deploy-commands'
import { registerInteractionCreate } from './events/interaction-create'
import { registerMessageCreate } from './events/message-create'
import { registerVoiceStateUpdate } from './events/voice-state-update'
import { startCacheSync } from './features/cache-sync'
import { startAnnouncementTick, sweepMissedAnnouncements } from './features/scheduled-tick'
import { handleThreadMessage } from './features/tickets'
import { flushBotLog, log } from './lib/log'
import { seedVoiceSessions, startVoiceTick } from './voice/tick'
import { tracker } from './voice/tracker'

async function main(): Promise<void> {
  log.info('boot', 'starting bot…')
  // Arm the in-memory config/events cache for THIS process (the bot is the reader; the API
  // never enables it, so the dashboard always reads fresh from Postgres). §2.1.
  rulesService.enableCache()
  const client = createClient()
  let cacheServer: Server | undefined

  registerMessageCreate(client)
  registerVoiceStateUpdate(client)
  registerInteractionCreate(client)
  // Guard ticket threads: let staff pull a 3rd person in via @mention; block everyone else.
  client.on(Events.MessageCreate, (m) => {
    void handleThreadMessage(m).catch((e) => log.error('tickets', `thread guard: ${e}`))
  })
  log.info('boot', 'registered message / voice / interaction handlers')

  client.once(Events.ClientReady, async (c) => {
    // Guard the startup handler like the running ticks (Phase 0): a DB hiccup here would
    // otherwise become an unhandledRejection. The global handler is the backstop, but keep
    // startup parity so a transient boot error is logged rather than only crash-restarting.
    try {
      log.info('boot', `logged in as ${c.user.tag} — watching ${c.guilds.cache.size} guild(s)`)
      await deployCommands().catch((e) => log.error('boot', `command deploy failed: ${e}`))
      // Warm the config/events cache up front so the first voice/reconcile tick issues no burst,
      // then start the invalidate listener + 30-min backstop. After this, an IDLE bot (nobody in
      // voice) issues ZERO DB queries and Neon scales to zero (§2.1).
      await rulesService
        .warm(client.guilds.cache.map((g) => g.id))
        .catch((e) => log.error('cache', `warm failed (will lazy-load): ${e}`))
      cacheServer = startCacheSync().server
      seedVoiceSessions(client)
      startVoiceTick(client)
      await sweepMissedAnnouncements()
      startAnnouncementTick()
      log.info('boot', `voice XP tick every ${env.XP_TICK_SECONDS}s — ready ✅`)
    } catch (e) {
      log.error('boot', `ClientReady init failed: ${e instanceof Error ? e.stack : String(e)}`)
    }
  })

  client.on(Events.Error, (e) => log.error('client', String(e)))
  client.on(Events.Warn, (m) => log.warn('client', m))

  // Crash cleanly on an uncaught error, shut down gracefully on a signal — both leave voice
  // + close the gateway first (tsx-watch sends SIGTERM on reload) so Discord doesn't keep a
  // ghost voice session that wedges the next join in "signalling", then flush the log so a
  // crash stack trace lands on disk. Shared wiring lives in @xp/core (§Phase 0 / §2.3).
  installCrashHandlers({
    onFatal: (err, kind) =>
      log.error('fatal', `${kind}: ${err instanceof Error ? err.stack : String(err)}`),
    cleanup: () => {
      log.info('boot', 'shutting down — leaving voice')
      tracker.disconnectAll()
      cacheServer?.close()
      void client.destroy()
    },
    flush: flushBotLog,
    exitGraceMs: 250,
    fatalLogName: 'bot',
  })

  await client.login(env.DISCORD_TOKEN)
}

main().catch((e) => {
  log.error('fatal', String(e))
  process.exit(1)
})
