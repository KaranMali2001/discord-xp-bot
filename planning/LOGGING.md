# Logging — how sessions get recorded

Manual for now: when the user says **"checkpoint"** (or ends a session), the agent runs the
checkpoint below. Automate later via a Stop hook if the rhythm sticks.

## Session layout
```
planning/sessions/NN-topic/
  session.md   # goal · done · next   (~10 lines)
  prompts.md   # chronological: prompt → 1-line response
```

## Checkpoint (run at session end)
1. **prompts.md** — append each user prompt this session + a 1-line response summary.
2. **session.md** — fill goal / done / next.
3. **INDEX.md** — add one line: `NN · topic · date · one-liner`.
4. **DECISIONS.md** — add any decision made (`date · choice · why · revisit-if`).
5. **Living docs** (OVERVIEW / TECH-STACK) — update only if the truth changed.

## Rules
- Keep it short — one line per prompt, one line per decision.
- `sessions/` is append-only history — never rewrite past sessions.
- Living docs are the current truth — overwrite freely.
