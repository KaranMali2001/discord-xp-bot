import { xpService } from '@xp/core'

export const leaderboardController = {
  get(guildId: string, limit: number, offset: number) {
    return {
      entries: xpService.leaderboard(guildId, limit, offset),
      total: xpService.count(guildId),
    }
  },
}
