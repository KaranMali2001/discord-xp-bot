/**
 * Pure single-tier level-role logic. No I/O — given a member's level, the guild's
 * reward map, and the roles they currently hold, it decides which reward role they
 * should end up with. See CONTEXT.md ("Level Reward Role", "Reconcile").
 */

export interface LevelReward {
  level: number
  roleId: string
  message?: string | null
}

export interface RoleDiff {
  /** Reward role ids to add (0 or 1). */
  add: string[]
  /** Reward role ids to remove (stale lower tiers the member still holds). */
  remove: string[]
  /** The single reward role the member should hold now, or null if below all tiers. */
  targetRoleId: string | null
}

/** The reward with the highest `level` that is `<= memberLevel`, or null. */
export function targetTier(memberLevel: number, rewards: LevelReward[]): LevelReward | null {
  let best: LevelReward | null = null
  for (const r of rewards) {
    if (r.level <= memberLevel && (best === null || r.level > best.level)) best = r
  }
  return best
}

/**
 * Reconcile decision: the member should hold exactly the target tier's role (if any).
 * Add it if missing; remove any *other* reward role they still hold. Roles that aren't
 * part of the reward map are never touched.
 */
export function reconcileDecision(
  currentRoleIds: string[],
  memberLevel: number,
  rewards: LevelReward[],
): RoleDiff {
  const rewardRoleIds = new Set(rewards.map((r) => r.roleId))
  const current = new Set(currentRoleIds)
  const targetRoleId = targetTier(memberLevel, rewards)?.roleId ?? null

  const add = targetRoleId && !current.has(targetRoleId) ? [targetRoleId] : []
  const remove = currentRoleIds.filter((id) => rewardRoleIds.has(id) && id !== targetRoleId)

  return { add, remove, targetRoleId }
}
