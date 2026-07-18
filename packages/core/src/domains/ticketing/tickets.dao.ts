import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '../../db/client'
import { ticketAttachments, ticketConfig, ticketParticipants, tickets } from '../../db/schema'
import { nowSec } from '../../util/time'
import type { TicketAttachmentInput, TicketConfigInput, TicketInput } from './tickets.schema'

export type TicketStatus = 'open' | 'resolved' | 'closed'
export type ParticipantRole = 'owner' | 'staff'

export type TicketConfig = typeof ticketConfig.$inferSelect
export type Ticket = typeof tickets.$inferSelect
export type TicketAttachment = typeof ticketAttachments.$inferSelect
export type TicketParticipant = typeof ticketParticipants.$inferSelect

export const ticketsDao = {
  // ── config ────────────────────────────────────────────────
  async getConfig(guildId: string): Promise<TicketConfig | undefined> {
    const [row] = await db.select().from(ticketConfig).where(eq(ticketConfig.guildId, guildId))
    return row
  },

  async upsertConfig(guildId: string, patch: Partial<TicketConfigInput>): Promise<TicketConfig> {
    const [row] = await db
      .insert(ticketConfig)
      .values({ guildId, ...patch, updatedAt: nowSec() })
      .onConflictDoUpdate({
        target: ticketConfig.guildId,
        set: { ...patch, updatedAt: nowSec() },
      })
      .returning()
    if (!row) throw new Error('ticket_config upsert returned no row')
    return row
  },

  // ── tickets ───────────────────────────────────────────────
  async create(guildId: string, input: TicketInput): Promise<Ticket> {
    const [row] = await db
      .insert(tickets)
      .values({
        guildId,
        userId: input.userId,
        username: input.username,
        subject: input.subject,
        description: input.description,
      })
      .returning()
    if (!row) throw new Error('Failed to create ticket')
    return row
  },

  async get(guildId: string, id: number): Promise<Ticket | undefined> {
    const [row] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.id, id)))
    return row
  },

  /** Link the private thread once staff creates it. */
  async setThread(id: number, threadId: string): Promise<void> {
    await db.update(tickets).set({ threadId }).where(eq(tickets.id, id))
  },

  /** Find a ticket by its thread id (the thread-message guard's lookup). */
  async getByThread(threadId: string): Promise<Ticket | undefined> {
    const [row] = await db.select().from(tickets).where(eq(tickets.threadId, threadId))
    return row
  },

  async setStatus(guildId: string, id: number, status: TicketStatus): Promise<Ticket | undefined> {
    const [row] = await db
      .update(tickets)
      .set({ status, resolvedAt: status === 'open' ? null : nowSec() })
      .where(and(eq(tickets.guildId, guildId), eq(tickets.id, id)))
      .returning()
    return row
  },

  async listByStatus(guildId: string, status: TicketStatus, limit = 25): Promise<Ticket[]> {
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.status, status)))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
  },

  // ── attachments ───────────────────────────────────────────
  // Image bytes live in Cloudinary (§2.2); this row stores only the public_id + url reference.
  async addAttachment(
    guildId: string,
    ticketId: number,
    input: TicketAttachmentInput,
  ): Promise<TicketAttachment> {
    const [row] = await db
      .insert(ticketAttachments)
      .values({
        ticketId,
        guildId,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        cloudinaryPublicId: input.cloudinaryPublicId ?? '',
        url: input.url ?? '',
      })
      .returning()
    if (!row) throw new Error('Failed to store ticket attachment')
    return row
  },

  /**
   * Attachment references for a ticket (lightweight — the heavy bytes live in Cloudinary).
   * Scoped by `guildId` as well as `ticketId` so a caller authorized for one guild can't read
   * another guild's attachments by guessing the numeric ticket id (§2.2 private-attachment rule).
   */
  async listAttachmentMeta(guildId: string, ticketId: number): Promise<TicketAttachment[]> {
    return db
      .select()
      .from(ticketAttachments)
      .where(and(eq(ticketAttachments.guildId, guildId), eq(ticketAttachments.ticketId, ticketId)))
  },

  async getAttachment(id: number): Promise<TicketAttachment | undefined> {
    const [row] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id))
    return row
  },

  // ── participants (per-user access on the hidden ticket channel) ──
  async addParticipant(
    guildId: string,
    ticketId: number,
    userId: string,
    role: ParticipantRole,
  ): Promise<void> {
    await db
      .insert(ticketParticipants)
      .values({ guildId, ticketId, userId, role })
      .onConflictDoNothing()
  },

  async isParticipant(ticketId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ userId: ticketParticipants.userId })
      .from(ticketParticipants)
      .where(and(eq(ticketParticipants.ticketId, ticketId), eq(ticketParticipants.userId, userId)))
    return Boolean(row)
  },

  async listParticipants(ticketId: number): Promise<TicketParticipant[]> {
    return db.select().from(ticketParticipants).where(eq(ticketParticipants.ticketId, ticketId))
  },

  /**
   * Is this user still a participant of some OTHER non-closed ticket in the guild? Used at
   * close time to decide whether their channel overwrite must stay (overwrites are shared
   * across every ticket in the one hidden channel).
   */
  async hasAccessElsewhere(
    guildId: string,
    userId: string,
    excludeTicketId: number,
  ): Promise<boolean> {
    const [row] = await db
      .select({ ticketId: ticketParticipants.ticketId })
      .from(ticketParticipants)
      .innerJoin(tickets, eq(tickets.id, ticketParticipants.ticketId))
      .where(
        and(
          eq(ticketParticipants.guildId, guildId),
          eq(ticketParticipants.userId, userId),
          ne(ticketParticipants.ticketId, excludeTicketId),
          ne(tickets.status, 'closed'),
        ),
      )
    return Boolean(row)
  },
}
