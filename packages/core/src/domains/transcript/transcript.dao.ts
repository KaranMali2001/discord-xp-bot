import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { transcriptJobs } from '../../db/schema'
import { nowSec } from '../../util/time'

export type TranscriptStatus = 'pending' | 'processing' | 'done' | 'error'

/** Everything the capturer knows when it finishes writing a WAV. */
export interface TranscriptJobInput {
  id: string
  guildId: string
  channelId: string
  sessionId: string
  userId: string
  username: string
  filePath: string
  startedAt: number // epoch seconds
  durationMs: number
  sampleRate: number
  channels: number
  encoding: string
}

export type TranscriptJob = typeof transcriptJobs.$inferSelect

export const transcriptDao = {
  /** Part 1: enqueue a captured utterance as `pending`. */
  insert(job: TranscriptJobInput): void {
    db.insert(transcriptJobs)
      .values({ ...job, status: 'pending' })
      .run()
  },

  /** Oldest-first jobs in a given state (the worker asks for `pending`). */
  listByStatus(status: TranscriptStatus, limit = 50): TranscriptJob[] {
    return db
      .select()
      .from(transcriptJobs)
      .where(eq(transcriptJobs.status, status))
      .orderBy(asc(transcriptJobs.startedAt))
      .limit(limit)
      .all()
  },

  /** All utterances of one capture window, in speaking order — for conversation views. */
  listBySession(guildId: string, sessionId: string): TranscriptJob[] {
    return db
      .select()
      .from(transcriptJobs)
      .where(and(eq(transcriptJobs.guildId, guildId), eq(transcriptJobs.sessionId, sessionId)))
      .orderBy(asc(transcriptJobs.startedAt))
      .all()
  },

  // ── Part 2 (worker) helpers ──────────────────────────────
  claim(id: string): void {
    db.update(transcriptJobs)
      .set({ status: 'processing', updatedAt: nowSec() })
      .where(eq(transcriptJobs.id, id))
      .run()
  },

  complete(id: string, text: string, language: string | null): void {
    db.update(transcriptJobs)
      .set({ status: 'done', text, language, updatedAt: nowSec() })
      .where(eq(transcriptJobs.id, id))
      .run()
  },

  fail(id: string, error: string): void {
    db.update(transcriptJobs)
      .set({ status: 'error', error, updatedAt: nowSec() })
      .where(eq(transcriptJobs.id, id))
      .run()
  },
}
