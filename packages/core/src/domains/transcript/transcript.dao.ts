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
  async insert(job: TranscriptJobInput): Promise<void> {
    await db.insert(transcriptJobs).values({ ...job, status: 'pending' })
  },

  /** Oldest-first jobs in a given state (the worker asks for `pending`). */
  async listByStatus(status: TranscriptStatus, limit = 50): Promise<TranscriptJob[]> {
    return db
      .select()
      .from(transcriptJobs)
      .where(eq(transcriptJobs.status, status))
      .orderBy(asc(transcriptJobs.startedAt))
      .limit(limit)
  },

  /** All utterances of one capture window, in speaking order — for conversation views. */
  async listBySession(guildId: string, sessionId: string): Promise<TranscriptJob[]> {
    return db
      .select()
      .from(transcriptJobs)
      .where(and(eq(transcriptJobs.guildId, guildId), eq(transcriptJobs.sessionId, sessionId)))
      .orderBy(asc(transcriptJobs.startedAt))
  },

  // ── Part 2 (worker) helpers ──────────────────────────────
  /**
   * Atomically claim a pending job for this worker. The `WHERE id = ? AND status = 'pending'`
   * guard means only ONE worker can win a given job even if several poll the same `pending`
   * row concurrently — the loser gets `false` (0 rows updated) and skips it, instead of two
   * workers both transcribing the same utterance. Returns true iff this call claimed the job.
   */
  async claim(id: string): Promise<boolean> {
    const rows = await db
      .update(transcriptJobs)
      .set({ status: 'processing', updatedAt: nowSec() })
      .where(and(eq(transcriptJobs.id, id), eq(transcriptJobs.status, 'pending')))
      .returning({ id: transcriptJobs.id })
    return rows.length > 0
  },

  async complete(id: string, text: string, language: string | null): Promise<void> {
    await db
      .update(transcriptJobs)
      .set({ status: 'done', text, language, updatedAt: nowSec() })
      .where(eq(transcriptJobs.id, id))
  },

  async fail(id: string, error: string): Promise<void> {
    await db
      .update(transcriptJobs)
      .set({ status: 'error', error, updatedAt: nowSec() })
      .where(eq(transcriptJobs.id, id))
  },
}
