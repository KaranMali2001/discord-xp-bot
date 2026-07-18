import { guildConfigInput, rulesDao, rulesService } from '@xp/core'
import { invalidateBotCache } from '../lib/cache-invalidate'
import { parse } from '../lib/validate'

export const configController = {
  get(guildId: string) {
    return rulesService.getConfig(guildId)
  },

  async put(guildId: string, body: unknown) {
    const patch = parse(guildConfigInput, body)
    const row = await rulesDao.upsertConfig(guildId, patch)
    invalidateBotCache(guildId) // refresh the bot's cached config (§2.1)
    return row
  },
}
