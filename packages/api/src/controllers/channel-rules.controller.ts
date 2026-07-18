import { channelRuleInput, rulesDao } from '@xp/core'
import { invalidateBotCache } from '../lib/cache-invalidate'
import { parse } from '../lib/validate'

export const channelRulesController = {
  list(guildId: string) {
    return rulesDao.listChannelRules(guildId)
  },

  async put(guildId: string, body: unknown) {
    const input = parse(channelRuleInput, body)
    const row = await rulesDao.upsertChannelRule(guildId, input)
    invalidateBotCache(guildId) // channel multiplier/no-xp change (§2.1)
    return row
  },

  async remove(guildId: string, channelId: string) {
    await rulesDao.deleteChannelRule(guildId, channelId)
    invalidateBotCache(guildId)
    return { ok: true }
  },
}
