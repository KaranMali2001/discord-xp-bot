import { applyTicketSetup, imageStore, ticketSetupInput, ticketsService } from '@xp/core'
import { parse } from '../lib/validate'

export const ticketsController = {
  /** Current ticket config (or null if never set up). */
  async get(guildId: string) {
    return (await ticketsService.getConfig(guildId)) ?? null
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

  /**
   * Attachment references for a ticket, each with a freshly-minted signed Cloudinary delivery
   * URL (attachments are private, so the raw public_id is never handed out — §2.2). `url` is
   * null when Cloudinary isn't configured or the row has no upload yet.
   */
  async listAttachments(guildId: string, ticketId: number) {
    const rows = await ticketsService.listAttachmentMeta(guildId, ticketId)
    return rows.map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      url: imageStore.signedUrl(a.cloudinaryPublicId),
    }))
  },
}
