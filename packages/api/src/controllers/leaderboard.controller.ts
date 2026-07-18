import { xpService } from '@xp/core'

export const leaderboardController = {
  async get(guildId: string, limit: number, offset: number) {
    const [entries, total] = await Promise.all([
      xpService.leaderboard(guildId, limit, offset),
      xpService.count(guildId),
    ])
    return { entries, total }
  },
}
