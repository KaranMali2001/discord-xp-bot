import type BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Client from 'libsql'
import { env } from '../env'
import { resolveDatabaseUrl } from '../util/paths'
import * as schema from './schema'

/**
 * `libsql` is a drop-in for better-sqlite3 with the same synchronous API, so the whole
 * (sync) DAO layer works unchanged whether we talk to a local file or a remote Turso DB.
 *  - Local dev:   DATABASE_URL=file:./dev.db          → opens a file
 *  - Production:  DATABASE_URL=libsql://….turso.io    → remote Turso (needs DATABASE_AUTH_TOKEN)
 */
const isRemote = /^(libsql|https?|wss?):\/\//.test(env.DATABASE_URL)

// libsql accepts `authToken` at runtime for remote Turso, but its Options type omits it.
const remoteOpts = { authToken: env.DATABASE_AUTH_TOKEN } as ConstructorParameters<typeof Client>[1]
const client = isRemote
  ? new Client(env.DATABASE_URL, remoteOpts)
  : new Client(resolveDatabaseUrl(env.DATABASE_URL))

// WAL / foreign-key pragmas only make sense on a local file; the remote server manages its own.
if (!isRemote) {
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')
}

// libsql mirrors better-sqlite3's API; the cast only bridges the nominal type difference.
export const db = drizzle(client as unknown as BetterSqlite3.Database, { schema })
export type DB = typeof db
