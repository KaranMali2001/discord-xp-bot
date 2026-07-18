/**
 * Decide whether a Postgres connection URL must use verified TLS.
 *
 * Rule: any REMOTE host requires SSL; only truly local endpoints are allowed plaintext. This is
 * the single source of truth shared by the app pool (db/client.ts) and drizzle-kit
 * (drizzle.config.ts) so migrations and the running app agree on TLS. Neon (`*.neon.tech`) is the
 * production target and is always remote → always TLS.
 *
 * "Local" = localhost / loopback / a bare hostname with no dots (a docker-compose service name
 * like `postgres`, or a plain LAN name). Everything with a dotted domain (neon.tech, RDS, any
 * managed PG) is treated as remote and gets `rejectUnauthorized: true`.
 */
export function requireSsl(url: string | undefined): boolean {
  const host = dbHost(url)
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
  // A dotless hostname is a docker service name / local alias, not a public host.
  if (!host.includes('.')) return false
  return true
}

/** Extract the hostname from a postgres:// URL, tolerating malformed input (returns undefined). */
export function dbHost(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
}
