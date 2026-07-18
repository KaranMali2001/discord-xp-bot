import { createLogFileDest, env, type LogFileDest } from '@xp/core'
import pino from 'pino'

/**
 * Structured Pino logger for the bot — same engine the API uses, so both services emit uniform
 * JSON lines (level, time, `tag`, `err`) that are grep/jq-able and ready for a log pipeline /
 * error tracker. When LOG_DIR is set each line is ALSO teed to a host-bind-mounted file (survives
 * `docker compose down --remove-orphans`, §2.3); otherwise stdout only.
 *
 * The public `log.info|warn|error|debug(tag, msg)` shape is unchanged, so every existing call
 * site keeps working — `tag` just becomes a structured field instead of a bracketed prefix.
 */
export const botLogFileDest: LogFileDest | undefined = createLogFileDest('bot')

const logger = botLogFileDest
  ? pino(
      { level: env.LOG_LEVEL },
      pino.multistream([{ stream: process.stdout }, { stream: botLogFileDest }]),
    )
  : pino({ level: env.LOG_LEVEL })

/** Flush the persistent bot log file synchronously (no-op when LOG_DIR unset). */
export function flushBotLog(): void {
  botLogFileDest?.flushSync?.()
}

type Level = 'error' | 'warn' | 'info' | 'debug'
const at = (level: Level) => (tag: string, msg: string) => logger[level]({ tag }, msg)

/** Tiny leveled logger. Set LOG_LEVEL=debug in .env to see per-tick voice detail. */
export const log = {
  error: at('error'),
  warn: at('warn'),
  info: at('info'),
  debug: at('debug'),
}
