import { env, installCrashHandlers } from '@xp/core'
import { buildApp } from './app'
import { apiLogFileDest, apiLogger } from './lib/logger'

// Crash cleanly on unrecoverable errors and flush the log file on the way out so the stack
// trace lands on disk (survives the container). Shared wiring lives in @xp/core (§Phase 0 / §2.3).
installCrashHandlers({
  onFatal: (err, kind) => apiLogger.error(err, kind),
  flush: () => apiLogFileDest?.flushSync?.(),
  fatalLogName: 'api',
})

async function main(): Promise<void> {
  const app = await buildApp()
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  app.log.info(`API listening on http://localhost:${env.API_PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
