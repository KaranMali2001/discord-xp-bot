import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { env } from '../env'
import { resolveDatabaseUrl } from '../util/paths'
import * as schema from './schema'

const file = resolveDatabaseUrl(env.DATABASE_URL)
const sqlite = new Database(file)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
