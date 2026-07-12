import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EndBehaviorType, type VoiceReceiver } from '@discordjs/voice'
import { type EnqueueInput, env, nowSec, transcriptService } from '@xp/core'
import prism from 'prism-media'
import { log } from '../lib/log'

// Discord voice audio, once decoded from Opus, is s16le 48 kHz stereo (20 ms frames).
const SAMPLE_RATE = 48_000
const CHANNELS = 2
const BYTES_PER_SAMPLE = 2
const FRAME_SIZE = 960
const HEADER_BYTES = 44
// Discord stops sending packets during silence, so this cleanly ends an utterance.
const SILENCE_MS = 1_000

/** Recordings in flight, keyed guildId:userId — one utterance per speaker at a time. */
const active = new Set<string>()

export interface CaptureContext {
  receiver: VoiceReceiver
  guildId: string
  channelId: string
  sessionId: string
  userId: string
  username: string
}

/**
 * Part 1 of the transcript pipeline. Called on every Discord `speaking start`; records
 * that speaker's utterance to a WAV under AUDIO_ROOT and enqueues a transcript_jobs row
 * for a separate Whisper worker. No-op unless TRANSCRIPTS_ENABLED. Fire-and-forget — it
 * never blocks the voice/XP path.
 */
export function onSpeakingStart(ctx: CaptureContext): void {
  if (!env.TRANSCRIPTS_ENABLED) return
  const key = `${ctx.guildId}:${ctx.userId}`
  if (active.has(key)) return // already capturing this speaker's current utterance
  active.add(key)
  record(ctx)
    .catch((e) => log.error('capture', `record failed: ${(e as Error).message}`))
    .finally(() => active.delete(key))
}

/** Minimal canonical WAV header for our fixed PCM format; sizes patched in after write. */
function wavHeader(dataLen: number): Buffer {
  const b = Buffer.alloc(HEADER_BYTES)
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + dataLen, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16) // fmt chunk size
  b.writeUInt16LE(1, 20) // audio format = PCM
  b.writeUInt16LE(CHANNELS, 22)
  b.writeUInt32LE(SAMPLE_RATE, 24)
  b.writeUInt32LE(byteRate, 28)
  b.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32) // block align
  b.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34) // bits per sample
  b.write('data', 36)
  b.writeUInt32LE(dataLen, 40)
  return b
}

async function record(ctx: CaptureContext): Promise<void> {
  const id = randomUUID()
  const startMs = Date.now()
  const startedAt = nowSec()
  const dir = join(env.AUDIO_ROOT, ctx.guildId, ctx.sessionId)
  await mkdir(dir, { recursive: true })
  const base = `${ctx.userId}_${startMs}`
  const wavPath = join(dir, `${base}.wav`)

  const opus = ctx.receiver.subscribe(ctx.userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_MS },
  })
  const decoder = new prism.opus.Decoder({
    rate: SAMPLE_RATE,
    channels: CHANNELS,
    frameSize: FRAME_SIZE,
  })
  const out = createWriteStream(wavPath)
  out.write(wavHeader(0)) // placeholder — real sizes patched once the utterance ends

  // Resolve on close (fires after a clean end OR a mid-stream disconnect). We salvage
  // whatever was written rather than reject, so a dropped connection still yields audio.
  await new Promise<void>((resolve) => {
    const endOut = () => {
      if (!out.writableEnded) out.end()
    }
    out.once('close', resolve)
    out.once('error', (e) => {
      log.warn('capture', `write error for ${base}: ${e.message}`)
      resolve()
    })
    opus.once('error', endOut)
    decoder.once('error', endOut)
    opus.pipe(decoder).pipe(out)
  })

  const dataLen = Math.max(0, out.bytesWritten - HEADER_BYTES)
  if (dataLen === 0) return // silence only / nothing captured — leave no artifact behind

  // Patch RIFF + data chunk sizes now that the length is known.
  const fh = await open(wavPath, 'r+')
  try {
    const riff = Buffer.alloc(4)
    riff.writeUInt32LE(36 + dataLen, 0)
    await fh.write(riff, 0, 4, 4)
    const data = Buffer.alloc(4)
    data.writeUInt32LE(dataLen, 0)
    await fh.write(data, 0, 4, 40)
  } finally {
    await fh.close()
  }

  const durationMs = Math.round((dataLen / (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE)) * 1_000)
  const meta: EnqueueInput = {
    id,
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    username: ctx.username,
    filePath: wavPath,
    startedAt,
    durationMs,
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    encoding: 'pcm_s16le',
  }

  // Sidecar JSON keeps the file self-describing for a worker that only sees the folder
  // (the DB row is the queue; the sidecar is the fallback contract).
  await writeFile(
    join(dir, `${base}.json`),
    JSON.stringify({ ...meta, status: 'pending' }, null, 2),
  )
  transcriptService.enqueue(meta)
  log.info('capture', `saved utterance ${base} (${durationMs}ms) → pending`)
}
