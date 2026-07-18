import tseslint from 'typescript-eslint'

/**
 * Minimal, type-aware ESLint config that exists for ONE reason: a gold-standard
 * floating-promise gate for the Postgres async conversion. Biome's own
 * `noFloatingPromises` is type-aware but has known drizzle-thenable edge cases
 * (biome#8476) and currently crashes on this codebase, so the TypeScript
 * type-checker-backed typescript-eslint rules are the authoritative net. Biome
 * still owns formatting + every other lint; this only runs the two promise rules.
 *
 * Scope: the async DB surface (core/api/bot `src`). `web` is types-only and
 * `landing` has no DB access, so neither needs it.
 */
export default tseslint.config(
  {
    files: ['packages/core/src/**/*.ts', 'packages/api/src/**/*.ts', 'packages/bot/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // A dropped `await` on a DB write silently loses data — the #1 risk of this migration.
      // This is the load-bearing gate; keep it fully on.
      '@typescript-eslint/no-floating-promises': 'error',
      // Keep the high-value sub-check — `checksConditionals` catches a Promise used in a
      // boolean/conditional context, i.e. the `if (canManage(...))` authz-bypass class.
      // `checksVoidReturn` is scoped OFF: every void-return site here is an intentionally
      // async, internally try/catch-guarded event/timer callback (discord.js `.on`, a Phase-0
      // guarded `setInterval`) or a Fastify async hook (officially supported), so flagging
      // them adds noise without catching a real bug. Dropped awaits inside those bodies are
      // still caught by no-floating-promises above.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/drizzle/**',
      '**/drizzle_sqlite_archive/**',
      '**/*.gen.ts',
    ],
  },
)
