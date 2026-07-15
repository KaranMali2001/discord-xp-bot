import { applyTicketSetup, ticketSetupInput, ticketsService } from '@xp/core'
import { parse } from '../lib/validate'

export const ticketsController = {
  /** Current ticket config (or null if never set up). */
  get(guildId: string) {
    return ticketsService.getConfig(guildId) ?? null
  },

  /**
   * Dashboard "Save": validate the three picks, then apply permission overwrites, (re)post
   * the panel, and persist — all inside core's shared setup. Discord/validation failures
   * bubble up to the app error handler as 4xx/5xx.
   */
  setup(guildId: string, body: unknown) {
    const input = parse(ticketSetupInput, body)
    return applyTicketSetup(guildId, input)
  },
}
