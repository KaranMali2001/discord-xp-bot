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
  getConfig(guildId: string): TicketConfig | undefined {
    return db.select().from(ticketConfig).where(eq(ticketConfig.guildId, guildId)).get()
  },

  upsertConfig(guildId: string, patch: Partial<TicketConfigInput>): TicketConfig {
    return db
      .insert(ticketConfig)
      .values({ guildId, ...patch, updatedAt: nowSec() })
      .onConflictDoUpdate({
        target: ticketConfig.guildId,
        set: { ...patch, updatedAt: nowSec() },
      })
      .returning()
      .get()
  },

  // ── tickets ───────────────────────────────────────────────
  create(guildId: string, input: TicketInput): Ticket {
    const row = db
      .insert(tickets)
      .values({
        guildId,
        userId: input.userId,
        username: input.username,
        subject: input.subject,
        description: input.description,
      })
      .returning()
      .get()
    if (!row) throw new Error('Failed to create ticket')
    return row
  },

  get(guildId: string, id: number): Ticket | undefined {
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.id, id)))
      .get()
  },

  /** Persist the collection-channel message id (reuses the mod_message_id column). */
  setModMessage(id: number, modMessageId: string): void {
    db.update(tickets).set({ modMessageId }).where(eq(tickets.id, id)).run()
  },

  /** Link the private thread once staff creates it. */
  setThread(id: number, threadId: string): void {
    db.update(tickets).set({ threadId }).where(eq(tickets.id, id)).run()
  },

  /** Find a ticket by its thread id (the thread-message guard's lookup). */
  getByThread(threadId: string): Ticket | undefined {
    return db.select().from(tickets).where(eq(tickets.threadId, threadId)).get()
  },

  setStatus(guildId: string, id: number, status: TicketStatus): Ticket | undefined {
    return db
      .update(tickets)
      .set({ status, resolvedAt: status === 'open' ? null : nowSec() })
      .where(and(eq(tickets.guildId, guildId), eq(tickets.id, id)))
      .returning()
      .get()
  },

  listByStatus(guildId: string, status: TicketStatus, limit = 25): Ticket[] {
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.status, status)))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .all()
  },

  // ── attachments ───────────────────────────────────────────
  addAttachment(guildId: string, ticketId: number, input: TicketAttachmentInput): TicketAttachment {
    const row = db
      .insert(ticketAttachments)
      .values({
        ticketId,
        guildId,
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        data: input.data,
      })
      .returning()
      .get()
    if (!row) throw new Error('Failed to store ticket attachment')
    return row
  },

  /** Bytes excluded — the list view never needs the blob, only metadata. */
  listAttachmentMeta(ticketId: number): Omit<TicketAttachment, 'data'>[] {
    return db
      .select({
        id: ticketAttachments.id,
        ticketId: ticketAttachments.ticketId,
        guildId: ticketAttachments.guildId,
        filename: ticketAttachments.filename,
        contentType: ticketAttachments.contentType,
        sizeBytes: ticketAttachments.sizeBytes,
        createdAt: ticketAttachments.createdAt,
      })
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .all()
  },

  getAttachment(id: number): TicketAttachment | undefined {
    return db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id)).get()
  },

  // ── participants (per-user access on the hidden ticket channel) ──
  addParticipant(guildId: string, ticketId: number, userId: string, role: ParticipantRole): void {
    db.insert(ticketParticipants)
      .values({ guildId, ticketId, userId, role })
      .onConflictDoNothing()
      .run()
  },

  isParticipant(ticketId: number, userId: string): boolean {
    const row = db
      .select({ userId: ticketParticipants.userId })
      .from(ticketParticipants)
      .where(and(eq(ticketParticipants.ticketId, ticketId), eq(ticketParticipants.userId, userId)))
      .get()
    return Boolean(row)
  },

  listParticipants(ticketId: number): TicketParticipant[] {
    return db
      .select()
      .from(ticketParticipants)
      .where(eq(ticketParticipants.ticketId, ticketId))
      .all()
  },

  /**
   * Is this user still a participant of some OTHER non-closed ticket in the guild? Used at
   * close time to decide whether their channel overwrite must stay (overwrites are shared
   * across every ticket in the one hidden channel).
   */
  hasAccessElsewhere(guildId: string, userId: string, excludeTicketId: number): boolean {
    const row = db
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
      .get()
    return Boolean(row)
  },
}
