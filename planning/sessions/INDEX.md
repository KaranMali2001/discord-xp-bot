# Sessions

- **00** · Planning & stack decisions · 2026-07-07 · researched bots, locked TS/Node/discord.js/Fastify/Drizzle, layered arch, session-logging convention.
- **01** · Implementation · 2026-07-07 · built + verified all 4 packages (core/bot/api/web); typecheck + Biome + smoke test green.
- **02** · Announcements + Turso + deploy · 2026-07-15 · shipped announcements (send + one-off scheduling, slash + dashboard); re-baselined migrations; moved prod DB to Turso via the sync libsql drop-in (ADR 0002); deployed to the VPS (fixed a live ca-certificates TLS bug). Auth + transcription Part 2 explored, not yet built.
