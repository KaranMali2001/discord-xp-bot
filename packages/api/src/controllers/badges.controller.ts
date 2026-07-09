import { badgeInput, badgesService } from '@xp/core'
import { parse } from '../lib/validate'

export const badgesController = {
  list(guildId: string) {
    return badgesService.list(guildId)
  },

  put(guildId: string, body: unknown) {
    const input = parse(badgeInput, body)
    return badgesService.upsert(guildId, input)
  },

  remove(guildId: string, key: string) {
    badgesService.remove(guildId, key)
    return { ok: true }
  },
}
