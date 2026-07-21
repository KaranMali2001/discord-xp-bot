import { useQuery } from '@tanstack/react-query'
import { endpoints, type LeaderboardPage } from '@/lib/api'

const key = (guildId: string, limit: number, offset: number) =>
  ['leaderboard', guildId, limit, offset] as const

/**
 * Refreshes on a gentle 60s cadence, and only while the tab is focused. Each poll runs TWO
 * Postgres queries server-side (leaderboard + count), so the old 5s interval kept Neon awake
 * around the clock for every open tab. 60s foreground-only keeps the board live enough while
 * letting Neon scale to zero when nobody is looking. It also refetches on window focus, so
 * returning to the tab gives an immediate up-to-date board.
 */
export function useLeaderboard(guildId: string, limit = 25, offset = 0) {
  return useQuery<LeaderboardPage>({
    queryKey: key(guildId, limit, offset),
    queryFn: () => endpoints.leaderboard.get(guildId, limit, offset),
    enabled: guildId.length > 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}
