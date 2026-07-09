import { channelRuleInput, rulesDao } from '@xp/core'
import { parse } from '../lib/validate'

export const channelRulesController = {
  list(guildId: string) {
    return rulesDao.listChannelRules(guildId)
  },

  put(guildId: string, body: unknown) {
    const input = parse(channelRuleInput, body)
    return rulesDao.upsertChannelRule(guildId, input)
  },

  remove(guildId: string, channelId: string) {
    rulesDao.deleteChannelRule(guildId, channelId)
    return { ok: true }
  },
}
