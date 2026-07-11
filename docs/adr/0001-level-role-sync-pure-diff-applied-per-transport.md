# Reconcile derived state in core, applied over Discord REST from both processes

## Status

accepted

## Context & Decision

XP is the single source of truth; **Level**, the **Level Reward Role**, and **Badges**
are all derived from it. Live XP (chat/voice) is granted in the **bot** process;
dashboard **XP Boosts** are written in the **api** process. Both need to bring the same
derived state into sync on Discord.

We decided on **one shared Reconcile in `core`**, used by both processes:

- `core` computes the derived changes (level, single-tier role diff, newly-earned
  badges) **and** applies the Discord mutations **over Discord REST** using the bot
  token — the same REST path the picker endpoints already use.
- The **bot** calls Reconcile in-process after a live grant; the **api** calls it
  in-process after an XP Boost. **Neither process calls the other.**

## Considered options

- **Bot uses discord.js, api uses REST (two apply implementations):** rejected — two
  ways to mutate the same roles will drift; standardise on one REST apply in `core`.
- **api is the sole executor; bot calls the api to reconcile:** rejected — makes live
  level-up rewards depend on the api being up at runtime, a failure mode we don't need
  since the bot already holds the token and can call REST itself.

## Consequences

- Reconcile logic lives once in `core`; both processes are thin callers, so they can't
  diverge.
- Role mutation uses Discord REST, not discord.js — even inside the bot.
- **Announcements** (level-up / badge messages) are deliberately *not* part of Reconcile
  and are decided per trigger.
