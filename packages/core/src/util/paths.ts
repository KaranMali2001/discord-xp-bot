import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/**
 * Find the monorepo root by walking up for pnpm-workspace.yaml. Each package runs
 * from its own dir, so we can't trust process.cwd() for shared resources.
 */
export function findWorkspaceRoot(start: string = process.cwd()): string {
  let dir = start
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return start
}

/**
 * Resolve a `file:` DATABASE_URL to an absolute path anchored at the workspace root,
 * so the bot, API, and drizzle-kit all open the SAME sqlite file regardless of cwd.
 * Non-file URLs (e.g. postgres://) are returned unchanged.
 */
export function resolveDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:')) return databaseUrl
  const raw = databaseUrl.replace(/^file:/, '')
  return isAbsolute(raw) ? raw : join(findWorkspaceRoot(), raw)
}
