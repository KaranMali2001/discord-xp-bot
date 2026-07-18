/**
 * Bounded, error-CLASSIFYING retry for transient DB errors.
 *
 * With node-postgres the connection Pool self-heals — a dropped/terminated client is evicted
 * and a fresh one opened on the next query — so transient blips (ECONNRESET, "Connection
 * terminated", connect timeouts) recover on a retry. (This is exactly what libsql could NOT
 * do: its Hrana stream could wedge permanently, which is why we migrated.)
 *
 * We still FAIL FAST (rethrow, no retry) on deterministic query errors: a pg SQLSTATE whose
 * class is syntax/undefined (42xxx), integrity constraint (23xxx), data exception (22xxx),
 * bad auth (28xxx) or invalid catalog/schema (3D/3Fxxx) will never succeed on retry, so
 * retrying just hides a code/data bug behind backoff. Everything else — connection (08),
 * resource (53), serialization/deadlock (40), and plain network errors with no SQLSTATE — is
 * treated as transient and retried up to the cap.
 */

// pg SQLSTATE classes that are deterministic — retrying cannot help. Connection/resource classes
// (08/53/57) and non-SQLSTATE network errors (ECONNRESET, ETIMEDOUT, …) are intentionally absent
// so they fall through to the transient/retry path.
const NON_RETRYABLE_SQLSTATE_CLASSES = ['22', '23', '28', '3D', '3F', '42']

function pgSqlstateClass(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    // A pg error code is a 5-char SQLSTATE; network errors use names like 'ECONNRESET'.
    if (typeof code === 'string' && code.length === 5) return code.slice(0, 2)
  }
  return undefined
}

function isPermanent(err: unknown): boolean {
  const cls = pgSqlstateClass(err)
  return cls !== undefined && NON_RETRYABLE_SQLSTATE_CLASSES.includes(cls)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withRetry<T>(
  fn: () => T | Promise<T>,
  opts: { retries?: number; backoffMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3
  let backoff = opts.backoffMs ?? 100

  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      // Never retry a deterministic query error — rethrow immediately (retrying can't fix it).
      if (isPermanent(err) || attempt >= retries) throw err
      attempt++
      await sleep(backoff)
      backoff *= 2
    }
  }
}
