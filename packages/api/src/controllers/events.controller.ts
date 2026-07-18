import { eventBase, eventInput, rulesDao, voiceService } from '@xp/core'
import { invalidateBotCache } from '../lib/cache-invalidate'
import { parse } from '../lib/validate'

export const eventsController = {
  list(guildId: string) {
    return rulesDao.listEvents(guildId)
  },

  /** Per-member voice-duration summary for one event (attendance dashboard). */
  async attendance(guildId: string, id: number) {
    return { eventId: id, rows: await voiceService.statsForEvent(guildId, id) }
  },

  async create(guildId: string, body: unknown) {
    const input = parse(eventInput, body)
    const row = await rulesDao.createEvent(guildId, input)
    invalidateBotCache(guildId) // a new event changes the bot's multiplier decisions (§2.1)
    return row
  },

  async update(guildId: string, id: number, body: unknown) {
    // PATCH is partial — validate against the same schema but allow any subset.
    const input = parse(eventBase.partial(), body)
    const row = await rulesDao.updateEvent(guildId, id, input)
    invalidateBotCache(guildId)
    return row
  },

  async remove(guildId: string, id: number) {
    await rulesDao.deleteEvent(guildId, id)
    invalidateBotCache(guildId)
    return { ok: true }
  },
}
