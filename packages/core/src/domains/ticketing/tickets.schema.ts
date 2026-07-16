import { z } from 'zod'

/**
 * Config for the ticket system. Both channels are optional at rest so `/ticket-setup`
 * can be run incrementally, but the bot only shows the panel once both are set.
 */
export const ticketConfigInput = z.object({
  panelChannelId: z.string().min(1).nullable().default(null),
  ticketChannelId: z.string().min(1).nullable().default(null),
  staffRoleId: z.string().min(1).nullable().default(null),
  panelMessageId: z.string().min(1).nullable().default(null),
  enabled: z.boolean().default(true),
})

export type TicketConfigInput = z.infer<typeof ticketConfigInput>

/** Dashboard / slash-command setup payload: the three picks that drive everything. */
export const ticketSetupInput = z.object({
  panelChannelId: z.string().min(1),
  ticketChannelId: z.string().min(1),
  staffRoleId: z.string().min(1),
})

export type TicketSetupInput = z.infer<typeof ticketSetupInput>

/** A newly raised ticket, straight from the modal (mirrors Discord's modal limits). */
export const ticketInput = z.object({
  userId: z.string().min(1),
  username: z.string().default(''),
  // Discord short text input caps at 4000, but keep subjects tight for the list view.
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).default(''),
})

export type TicketInput = z.infer<typeof ticketInput>

/** One decoded image attachment to persist alongside a ticket. */
export const ticketAttachmentInput = z.object({
  filename: z.string().default('image'),
  contentType: z.string().default('application/octet-stream'),
  sizeBytes: z.number().int().nonnegative().default(0),
  data: z.instanceof(Buffer),
})

export type TicketAttachmentInput = z.infer<typeof ticketAttachmentInput>
