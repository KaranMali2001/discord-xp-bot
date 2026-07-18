import { createLogFileDest, env, type LogFileDest } from '@xp/core'
import pino from 'pino'

/**
 * The API's Pino logger, in its own module so both the Fastify app and standalone helpers (e.g.
 * the bot-cache invalidate client) share ONE structured logger without importing `app.ts` (which
 * would create a cycle: app → routes → controllers → helper → app).
 *
 * Tees to a host-bind-mounted file (survives `docker compose down --remove-orphans`) via a Pino
 * async destination + stdout when LOG_DIR is set; stdout only otherwise (§2.3). `apiLogFileDest`
 * is exported so the entrypoint's crash/shutdown handlers can flush it.
 */
export const apiLogFileDest: LogFileDest | undefined = createLogFileDest('api')

export const apiLogger = apiLogFileDest
  ? pino(
      { level: env.LOG_LEVEL },
      pino.multistream([{ stream: process.stdout }, { stream: apiLogFileDest }]),
    )
  : pino({ level: env.LOG_LEVEL })
