import { guildConfigInput, rulesDao, rulesService } from '@xp/core'
import { parse } from '../lib/validate'

export const configController = {
  get(guildId: string) {
    return rulesService.getConfig(guildId)
  },

  put(guildId: string, body: unknown) {
    const patch = parse(guildConfigInput, body)
    return rulesDao.upsertConfig(guildId, patch)
  },
}
