import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import pino from 'pino'
import { env } from '../env'

/** A Pino async file destination — exposes `write` (tee a line) and `flushSync` (drain on exit). */
export type LogFileDest = ReturnType<typeof pino.destination>

/**
 * Create a Pino async file destination under LOG_DIR, or `undefined` when LOG_DIR is unset
 * (local dev → stdout only). Buffered (`sync:false` + `minLength`) so writes stay off the hot
 * path; the file lives on a host bind-mount, outside the container, so it survives
 * `docker compose down --remove-orphans`, container recreation, and a daemon crash (§2.3).
 */
export function createLogFileDest(name: string): LogFileDest | undefined {
  if (!env.LOG_DIR) return undefined
  const dest = pino.destination({
    dest: `${env.LOG_DIR}/${name}.log`,
    sync: false,
    minLength: 4096,
    mkdir: true,
  })
  // A bad/unwritable LOG_DIR surfaces as an async 'error' event (not a throw); swallow it so
  // logging degrades to stdout-only instead of emitting an unhandled stream error.
  dest.on('error', () => {})
  return dest
}

export interface CrashHandlerOptions {
  /** Log the fatal error. Routed through the caller's logger so the format stays consistent. */
  onFatal: (err: unknown, kind: 'uncaughtException' | 'unhandledRejection') => void
  /** Flush the buffered log file synchronously before exit (no-op when logging to stdout only). */
  flush?: () => void
  /** Best-effort cleanup (leave voice, close the server). Runs on crash AND signal; must not throw. */
  cleanup?: () => void
  /** ms to let async cleanup (e.g. `client.destroy()`) settle before forcing exit (default 0). */
  exitGraceMs?: number
  /**
   * When set (e.g. 'api' | 'bot'), the crash path ALSO appends the fatal line SYNCHRONOUSLY to
   * `${LOG_DIR}/${fatalLogName}.log` via `appendFileSync` — guaranteeing the stack trace lands
   * on disk even during an early-boot crash, before the async destination's fd is open (where
   * SonicBoom's `flushSync()` throws "not ready" and the trace would otherwise be lost, §2.3).
   */
  fatalLogName?: string
}

/**
 * Wire process-level crash + signal handlers once, in one place, so the bot and the api share
 * identical semantics (§Phase 0 + §2.3):
 *  - uncaughtException / unhandledRejection → CRASH CLEANLY: log → cleanup → flush → exit 1.
 *    After an uncaught throw Node is in an undefined state, so a fresh process is the real
 *    recovery; log-and-continue would leave a silent zombie (bot up, awards no XP).
 *  - SIGINT / SIGTERM → graceful: cleanup → flush → exit 0.
 *  - exit → final flush backstop.
 */
export function installCrashHandlers(opts: CrashHandlerOptions): void {
  const { onFatal, flush, cleanup, exitGraceMs = 0, fatalLogName } = opts
  let exiting = false
  const finish = (code: number): void => {
    if (exiting) return
    exiting = true
    try {
      cleanup?.()
    } catch {
      // already going down — best effort
    }
    try {
      flush?.()
    } catch {
      // best effort
    }
    if (exitGraceMs > 0) setTimeout(() => process.exit(code), exitGraceMs)
    else process.exit(code)
  }
  const crash =
    (kind: 'uncaughtException' | 'unhandledRejection') =>
    (err: unknown): void => {
      try {
        onFatal(err, kind)
      } catch {
        // best effort — we're already crashing
      }
      // Durable synchronous write of the crash line — survives even an early-boot crash where
      // the async destination's fd isn't open yet and `flushSync()` would throw and lose it.
      if (fatalLogName && env.LOG_DIR) {
        try {
          const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
          appendFileSync(
            join(env.LOG_DIR, `${fatalLogName}.log`),
            `${JSON.stringify({ t: Date.now(), level: 'fatal', kind, err: detail })}\n`,
          )
        } catch {
          // best effort — nothing more we can do on the crash path
        }
      }
      finish(1)
    }
  process.on('uncaughtException', crash('uncaughtException'))
  process.on('unhandledRejection', crash('unhandledRejection'))
  process.once('SIGINT', () => finish(0))
  process.once('SIGTERM', () => finish(0))
  process.on('exit', () => {
    try {
      flush?.()
    } catch {
      // noop
    }
  })
}
