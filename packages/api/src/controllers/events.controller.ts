import { eventBase, eventInput, rulesDao } from '@xp/core'
import { parse } from '../lib/validate'

export const eventsController = {
  list(guildId: string) {
    return rulesDao.listEvents(guildId)
  },

  create(guildId: string, body: unknown) {
    const input = parse(eventInput, body)
    return rulesDao.createEvent(guildId, input)
  },

  update(guildId: string, id: number, body: unknown) {
    // PATCH is partial — validate against the same schema but allow any subset.
    const input = parse(eventBase.partial(), body)
    return rulesDao.updateEvent(guildId, id, input)
  },

  remove(guildId: string, id: number) {
    rulesDao.deleteEvent(guildId, id)
    return { ok: true }
  },
}
