import {
  type ParticipantRole,
  type Ticket,
  type TicketConfig,
  type TicketParticipant,
  type TicketStatus,
  ticketsDao,
} from './tickets.dao'
import {
  type TicketAttachmentInput,
  type TicketConfigInput,
  type TicketInput,
  ticketAttachmentInput,
  ticketConfigInput,
  ticketInput,
} from './tickets.schema'

/**
 * Ticket system: a public panel button opens a modal (subject + description + images).
 * Each submission creates a private thread in the hidden ticket channel; the submitter
 * gets a personal View-Channel overwrite so they can reach it, and content lives inside
 * the thread. Validation lives here; the DAO is pure persistence.
 */
export const ticketsService = {
  getConfig(guildId: string): TicketConfig | undefined {
    return ticketsDao.getConfig(guildId)
  },

  /** True once both channels are configured — the panel can't work without them. */
  isReady(guildId: string): boolean {
    const c = ticketsDao.getConfig(guildId)
    return Boolean(c?.enabled && c.panelChannelId && c.ticketChannelId)
  },

  saveConfig(guildId: string, raw: Partial<TicketConfigInput>): TicketConfig {
    const patch = ticketConfigInput.partial().parse(raw)
    return ticketsDao.upsertConfig(guildId, patch)
  },

  /** Validate + persist a raised ticket. Throws ZodError on bad input. */
  create(guildId: string, raw: TicketInput): Ticket {
    const input = ticketInput.parse(raw)
    return ticketsDao.create(guildId, input)
  },

  get(guildId: string, id: number): Ticket | undefined {
    return ticketsDao.get(guildId, id)
  },

  getByThread(threadId: string): Ticket | undefined {
    return ticketsDao.getByThread(threadId)
  },

  setStatus(guildId: string, id: number, status: TicketStatus): Ticket | undefined {
    return ticketsDao.setStatus(guildId, id, status)
  },

  setModMessage(id: number, modMessageId: string): void {
    ticketsDao.setModMessage(id, modMessageId)
  },

  setThread(id: number, threadId: string): void {
    ticketsDao.setThread(id, threadId)
  },

  // ── participants / access ─────────────────────────────────
  addParticipant(guildId: string, ticketId: number, userId: string, role: ParticipantRole): void {
    ticketsDao.addParticipant(guildId, ticketId, userId, role)
  },

  isParticipant(ticketId: number, userId: string): boolean {
    return ticketsDao.isParticipant(ticketId, userId)
  },

  listParticipants(ticketId: number): TicketParticipant[] {
    return ticketsDao.listParticipants(ticketId)
  },

  /** Whether this user still needs channel access for some other open ticket. */
  hasAccessElsewhere(guildId: string, userId: string, excludeTicketId: number): boolean {
    return ticketsDao.hasAccessElsewhere(guildId, userId, excludeTicketId)
  },

  listByStatus(guildId: string, status: TicketStatus, limit?: number): Ticket[] {
    return ticketsDao.listByStatus(guildId, status, limit)
  },

  addAttachment(guildId: string, ticketId: number, raw: TicketAttachmentInput) {
    const input = ticketAttachmentInput.parse(raw)
    return ticketsDao.addAttachment(guildId, ticketId, input)
  },

  listAttachmentMeta(ticketId: number) {
    return ticketsDao.listAttachmentMeta(ticketId)
  },

  getAttachment(id: number) {
    return ticketsDao.getAttachment(id)
  },
}
