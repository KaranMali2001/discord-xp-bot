// ── env & db ──────────────────────────────────────────────
export { env, type Env } from './env'
export { db, type DB } from './db/client'
export * as schema from './db/schema'
export { nowSec, utcDay, utcClock } from './util/time'

// ── leveling (pure) ───────────────────────────────────────
export {
  xpForNextLevel,
  totalXpForLevel,
  levelFromXp,
  levelProgress,
} from './domains/leveling/leveling.service'

// ── rules ─────────────────────────────────────────────────
export { rulesService, DEFAULT_CONFIG, isEventActive } from './domains/rules/rules.service'
export type { ResolvedConfig } from './domains/rules/rules.service'
export { rulesDao } from './domains/rules/rules.dao'
export {
  guildConfigInput,
  channelRuleInput,
  eventBase,
  eventInput,
  levelRewardInput,
} from './domains/rules/rules.schema'
export type {
  GuildConfigInput,
  ChannelRuleInput,
  EventInput,
  LevelRewardInput,
} from './domains/rules/rules.schema'

// ── xp ────────────────────────────────────────────────────
export { xpService } from './domains/xp/xp.service'
export type { GrantResult, SkipReason } from './domains/xp/xp.service'
export { xpDao } from './domains/xp/xp.dao'
export type { Member, CounterDelta } from './domains/xp/xp.dao'

// ── voice ─────────────────────────────────────────────────
export { voiceService } from './domains/voice/voice.service'
export type { VoiceTick } from './domains/voice/voice.service'

// ── badges ────────────────────────────────────────────────
export { badgesService } from './domains/badges/badges.service'
export type { Badge } from './domains/badges/badges.dao'
export { badgeInput, BADGE_CRITERIA } from './domains/badges/badges.schema'
export type { BadgeInput } from './domains/badges/badges.schema'

// ── level-reward roles + reconcile ────────────────────────
export { discordRest, DiscordError } from './lib/discord-rest'
export type { DiscordRole, DiscordMember } from './lib/discord-rest'
export { targetTier, reconcileDecision } from './domains/rewards/level-roles.service'
export type { LevelReward, RoleDiff } from './domains/rewards/level-roles.service'
export { reconcileMember, announceReconcile } from './domains/rewards/reconcile.service'
export type { ReconcileResult } from './domains/rewards/reconcile.service'

// ── auth (identity data only) ─────────────────────────────
export { authService } from './domains/auth/auth.service'
