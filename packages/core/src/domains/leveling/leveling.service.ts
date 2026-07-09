/**
 * Leveling curve (MEE6-style). XP needed to go from level n → n+1 grows quadratically,
 * so early levels are quick and later ones take real activity.
 */
export function xpForNextLevel(level: number): number {
  return 5 * level * level + 50 * level + 100
}

/** Total cumulative XP required to *reach* `level`. */
export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 0; i < level; i++) total += xpForNextLevel(i)
  return total
}

/** Highest level fully covered by `xp`. */
export function levelFromXp(xp: number): number {
  let level = 0
  let remaining = xp
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level)
    level++
  }
  return level
}

/** Progress within the current level — handy for rank cards / the dashboard. */
export function levelProgress(xp: number): {
  level: number
  into: number
  need: number
  percent: number
} {
  const level = levelFromXp(xp)
  const into = xp - totalXpForLevel(level)
  const need = xpForNextLevel(level)
  return { level, into, need, percent: need === 0 ? 0 : Math.min(100, (into / need) * 100) }
}
