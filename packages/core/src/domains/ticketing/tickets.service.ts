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
  async getConfig(guildId: string): Promise<TicketConfig | undefined> {
    return ticketsDao.getConfig(guildId)
  },

  /** True once both channels are configured — the panel can't work without them. */
  async isReady(guildId: string): Promise<boolean> {
    const c = await ticketsDao.getConfig(guildId)
    return Boolean(c?.enabled && c.panelChannelId && c.ticketChannelId)
  },

  async saveConfig(guildId: string, raw: Partial<TicketConfigInput>): Promise<TicketConfig> {
    const patch = ticketConfigInput.partial().parse(raw)
    return ticketsDao.upsertConfig(guildId, patch)
  },

  /** Validate + persist a raised ticket. Throws ZodError on bad input. */
  async create(guildId: string, raw: TicketInput): Promise<Ticket> {
    const input = ticketInput.parse(raw)
    return ticketsDao.create(guildId, input)
  },

  async get(guildId: string, id: number): Promise<Ticket | undefined> {
    return ticketsDao.get(guildId, id)
  },

  async getByThread(threadId: string): Promise<Ticket | undefined> {
    return ticketsDao.getByThread(threadId)
  },

  async setStatus(guildId: string, id: number, status: TicketStatus): Promise<Ticket | undefined> {
    return ticketsDao.setStatus(guildId, id, status)
  },

  async setThread(id: number, threadId: string): Promise<void> {
    await ticketsDao.setThread(id, threadId)
  },

  // ── participants / access ─────────────────────────────────
  async addParticipant(
    guildId: string,
    ticketId: number,
    userId: string,
    role: ParticipantRole,
  ): Promise<void> {
    await ticketsDao.addParticipant(guildId, ticketId, userId, role)
  },

  async isParticipant(ticketId: number, userId: string): Promise<boolean> {
    return ticketsDao.isParticipant(ticketId, userId)
  },

  async listParticipants(ticketId: number): Promise<TicketParticipant[]> {
    return ticketsDao.listParticipants(ticketId)
  },

  /** Whether this user still needs channel access for some other open ticket. */
  async hasAccessElsewhere(
    guildId: string,
    userId: string,
    excludeTicketId: number,
  ): Promise<boolean> {
    return ticketsDao.hasAccessElsewhere(guildId, userId, excludeTicketId)
  },

  async listByStatus(guildId: string, status: TicketStatus, limit?: number): Promise<Ticket[]> {
    return ticketsDao.listByStatus(guildId, status, limit)
  },

  async addAttachment(guildId: string, ticketId: number, raw: TicketAttachmentInput) {
    const input = ticketAttachmentInput.parse(raw)
    return ticketsDao.addAttachment(guildId, ticketId, input)
  },

  async listAttachmentMeta(guildId: string, ticketId: number) {
    return ticketsDao.listAttachmentMeta(guildId, ticketId)
  },

  async getAttachment(id: number) {
    return ticketsDao.getAttachment(id)
  },
}
