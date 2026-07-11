import { endpoints } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/** Admin XP Boost. Invalidates the leaderboard so the new standing shows. */
export function useBoostXp(guildId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { userId: string; delta: number; username?: string }) =>
      endpoints.members.boostXp(guildId, vars.userId, {
        delta: vars.delta,
        username: vars.username,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaderboard', guildId] })
    },
  })
}
