import { type GrantResult, announceReconcile, reconcileMember } from '@xp/core'
import { log } from './log'

/**
 * Called after every XP grant (chat or voice). Delegates all Discord side effects to
 * core's Reconcile (level role + badges) and announcement, applied over REST — see
 * ADR 0001. Best-effort: never throws.
 *
 * `fallbackChannelId` is where to announce when no level-up channel is configured
 * (the channel the activity happened in).
 */
export async function processGrant(
  guildId: string,
  userId: string,
  result: GrantResult,
  fallbackChannelId?: string,
): Promise<void> {
  const reconciled = await reconcileMember(guildId, userId, result.oldLevel).catch((err) => {
    log.error('reconcile', `${userId}: ${(err as Error).message}`)
    return null
  })
  if (!reconciled) return

  if (reconciled.leveledUp) log.info('level', `${userId} → level ${reconciled.level}`)
  if (reconciled.newBadges.length > 0) {
    log.info('badge', `${userId} earned: ${reconciled.newBadges.map((b) => b.key).join(', ')}`)
  }

  await announceReconcile(guildId, userId, reconciled, { fallbackChannelId })
}
