import { type TranscriptJobInput, transcriptDao } from './transcript.dao'

/** Metadata a captured utterance carries; `id` is minted by the capturer so it can
 * name the sidecar/file consistently before the row exists. */
export type EnqueueInput = TranscriptJobInput

export const transcriptService = {
  /** Part 1: record a finished capture as a pending job. Idempotent per `id`. */
  async enqueue(input: EnqueueInput): Promise<void> {
    await transcriptDao.insert(input)
  },

  /** The worker's inbox. */
  pending: (limit?: number) => transcriptDao.listByStatus('pending', limit),

  /** Ordered utterances of one capture window (for reassembling a conversation). */
  bySession: transcriptDao.listBySession,
}
