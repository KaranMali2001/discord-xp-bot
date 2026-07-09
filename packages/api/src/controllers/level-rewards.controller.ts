import { levelRewardInput, rulesDao } from '@xp/core'
import { parse } from '../lib/validate'

export const levelRewardsController = {
  list(guildId: string) {
    return rulesDao.listLevelRewards(guildId)
  },

  put(guildId: string, body: unknown) {
    const input = parse(levelRewardInput, body)
    return rulesDao.upsertLevelReward(guildId, input)
  },

  remove(guildId: string, level: number) {
    rulesDao.deleteLevelReward(guildId, level)
    return { ok: true }
  },
}
