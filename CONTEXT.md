# Context: Discord XP Bot

A glossary of the domain language. Not a spec — terms and their precise meanings only.

## Glossary

### Level
A member's rank derived purely from their accumulated **XP**. Zero-based, monotonic
under normal play (only decreases if XP is manually edited/reset).

### Level Reward Role
A Discord role mapped to a specific **Level** threshold, assigned by the bot to give a
member a **persistent, visible rank display** in the member list / profile.

- **Purpose is cosmetic only** — it exists to *show* rank, not to grant permissions or
  unlock channels. (Permission-granting via level roles is explicitly out of scope for
  now; may be revisited later.)
- **Single-tier**: a member holds at most **one** Level Reward Role at a time — the
  highest tier whose threshold they have reached. Crossing into a higher tier removes
  the lower one. (Contrast with a *cumulative unlock*, which we are deliberately not
  building.)
- Appearance (colour, hoist, icon) is owned by whoever creates the Discord role. The
  **dashboard-creates** flow makes it hoisted + coloured automatically; the bot then
  only assigns/removes it.

### Reconcile
The single operation that brings a member's **derived state** into sync with their
current **XP**. XP is the only source of truth; level, tier role, and badge ownership
are all derived from it. One Reconcile does all three atomically:

1. recompute **Level** from XP,
2. diff + apply the **Level Reward Role** (single-tier: add the target tier, remove any
   other reward role — never touch non-reward roles),
3. evaluate + award any newly-earned **Badges**.

Reconcile is invoked wherever XP changes — live chat/voice grants and dashboard **XP
Boosts** alike — and performs its Discord mutations over Discord REST (see ADR 0001).
*Announcing* the change (messages) is a separate concern from Reconcile.

### XP Boost
An admin-initiated **XP** adjustment made from the dashboard (a signed delta, e.g.
+50 / −50). Triggers a **Reconcile** like any other XP change.

### Announcement
A message posted to the guild's single configured announcement channel
(`levelUpChannelId`) that **tags the member** (`{user}` → a real ping). Announcements
are separate from **Reconcile** (state is always synced; messaging is a UX layer) and
fire on a *threshold crossing* from **any** source — live grant or **XP Boost**:

- **Level-up** — the existing `levelUpMessage`.
- **New tier** — a distinct message naming the **Level Reward Role** reached
  (e.g. "you're now **Veteran**!"). Each tier carries its own optional message text
  (falling back to a global default). When a level-up and a tier crossing coincide, the
  tier message **supersedes** the plain level-up line (one ping, the bigger event).
- **Badge earned** — the existing per-badge message.

A boost that adds XP *without* crossing a level/tier/badge threshold is silent
(nothing to celebrate).
