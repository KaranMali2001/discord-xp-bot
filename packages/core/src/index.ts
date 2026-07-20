// ── env & db ──────────────────────────────────────────────

export { type DB, db } from './db/client'
export * as schema from './db/schema'
export type {
  AnnouncementInput,
  ScheduledAnnouncementInput,
} from './domains/announcements/announcements.schema'
export {
  announcementInput,
  MIN_LEAD_SEC,
  scheduledAnnouncementInput,
} from './domains/announcements/announcements.schema'
// ── announcements ─────────────────────────────────────────
export { announcementsService } from './domains/announcements/announcements.service'
export type {
  ScheduledAnnouncement,
  ScheduledStatus,
} from './domains/announcements/scheduled.dao'
export { scheduledDao } from './domains/announcements/scheduled.dao'
export { scheduledAnnouncementsService } from './domains/announcements/scheduled.service'
// ── auth (identity data only) ─────────────────────────────
export { authService } from './domains/auth/auth.service'
export type { Badge } from './domains/badges/badges.dao'
export type { BadgeInput } from './domains/badges/badges.schema'
export { BADGE_CRITERIA, badgeInput } from './domains/badges/badges.schema'
// ── badges ────────────────────────────────────────────────
export { badgesService } from './domains/badges/badges.service'
// ── leveling (pure) ───────────────────────────────────────
export {
  levelFromXp,
  levelProgress,
  totalXpForLevel,
  xpForNextLevel,
} from './domains/leveling/leveling.service'
export type { LevelReward, RoleDiff } from './domains/rewards/level-roles.service'
export { reconcileDecision, targetTier } from './domains/rewards/level-roles.service'
export type { ReconcileResult } from './domains/rewards/reconcile.service'
export { announceReconcile, reconcileMember } from './domains/rewards/reconcile.service'
export type { EventWithTargets } from './domains/rules/rules.dao'
export { rulesDao } from './domains/rules/rules.dao'
export type {
  ChannelRuleInput,
  EventInput,
  GuildConfigInput,
  LevelRewardInput,
} from './domains/rules/rules.schema'
export {
  channelRuleInput,
  eventBase,
  eventInput,
  guildConfigInput,
  levelRewardInput,
} from './domains/rules/rules.schema'
export type { ResolvedConfig } from './domains/rules/rules.service'
// ── rules ─────────────────────────────────────────────────
export { DEFAULT_CONFIG, isEventActive, rulesService } from './domains/rules/rules.service'
export type {
  ParticipantRole,
  Ticket,
  TicketAttachment,
  TicketConfig,
  TicketParticipant,
  TicketStatus,
} from './domains/ticketing/tickets.dao'
export { ticketsDao } from './domains/ticketing/tickets.dao'
export type {
  TicketAttachmentInput,
  TicketConfigInput,
  TicketInput,
  TicketSetupInput,
} from './domains/ticketing/tickets.schema'
export {
  ticketAttachmentInput,
  ticketConfigInput,
  ticketInput,
  ticketSetupInput,
} from './domains/ticketing/tickets.schema'
// ── ticketing ─────────────────────────────────────────────
export { ticketsService } from './domains/ticketing/tickets.service'
export { applyTicketSetup, buildTicketPanelPayload } from './domains/ticketing/tickets.setup'
export type {
  TranscriptJob,
  TranscriptJobInput,
  TranscriptStatus,
} from './domains/transcript/transcript.dao'
export { transcriptDao } from './domains/transcript/transcript.dao'
export type { EnqueueInput } from './domains/transcript/transcript.service'
// ── transcription (Part 1: capture + store; queue for a separate Whisper worker) ──
export { transcriptService } from './domains/transcript/transcript.service'
export type { EventAttendanceRow } from './domains/voice/voice.dao'
export type { DurationTick, VoiceTick } from './domains/voice/voice.service'
// ── voice ─────────────────────────────────────────────────
export { voiceService } from './domains/voice/voice.service'
export type { CounterDelta, Member } from './domains/xp/xp.dao'
export { xpDao } from './domains/xp/xp.dao'
export type { GrantResult, SkipReason } from './domains/xp/xp.service'
// ── xp ────────────────────────────────────────────────────
export { xpService } from './domains/xp/xp.service'
export { type Env, env } from './env'
export type { DiscordMember, DiscordRole } from './lib/discord-rest'
// ── level-reward roles + reconcile ────────────────────────
export { DiscordError, discordRest } from './lib/discord-rest'
export { imageStore, type UploadedImage } from './lib/image-store'
export type { CrashHandlerOptions, LogFileDest } from './logging'
export { createLogFileDest, installCrashHandlers } from './logging'
export { withRetry } from './util/retry'
export { formatIst, istDay, istWallClockToEpochSec, nowSec, utcClock, utcDay } from './util/time'
