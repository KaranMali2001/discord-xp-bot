import { useQuery } from '@tanstack/react-query'
import { endpoints, type LeaderboardPage } from '@/lib/api'

const key = (guildId: string, limit: number, offset: number) =>
  ['leaderboard', guildId, limit, offset] as const

/** Polls every 5s so the board stays live while the tab is open. */
export function useLeaderboard(guildId: string, limit = 25, offset = 0) {
  return useQuery<LeaderboardPage>({
    queryKey: key(guildId, limit, offset),
    queryFn: () => endpoints.leaderboard.get(guildId, limit, offset),
    enabled: guildId.length > 0,
    refetchInterval: 5000,
  })
}
