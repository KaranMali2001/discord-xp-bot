import { env } from '@xp/core'

const LEVELS = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 } as const
type Level = keyof typeof LEVELS
const threshold = LEVELS[env.LOG_LEVEL]

const stamp = () => new Date().toISOString().slice(11, 19)

function at(level: Level, icon: string) {
  return (tag: string, msg: string) => {
    if (LEVELS[level] <= threshold) console.log(`${stamp()} ${icon} [${tag}] ${msg}`)
  }
}

/** Tiny leveled logger. Set LOG_LEVEL=debug in .env to see per-tick voice detail. */
export const log = {
  error: at('error', '❌'),
  warn: at('warn', '⚠️ '),
  info: at('info', 'ℹ️ '),
  debug: at('debug', '· '),
}
