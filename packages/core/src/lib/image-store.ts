import { v2 as cloudinary } from 'cloudinary'
import { env } from '../env'

/**
 * Off-DB image storage for ticket attachments (§2.2). The raw bytes live in Cloudinary; Postgres
 * keeps only a `public_id` + `url` reference. Uploads are **authenticated** (not public) because
 * attachments come from private support threads — delivery is via short, signature-signed URLs the
 * API mints on demand, never a guessable public CDN URL.
 *
 * Everything is best-effort by design: when Cloudinary isn't configured (no API key yet) or an
 * upload fails, the caller keeps the ticket and stores an empty reference — it never throws out of
 * a handler (same Phase-0 containment rule).
 */

let configured = false
function ensureConfigured(): void {
  if (configured) return
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

export interface UploadedImage {
  publicId: string
  /** Cloudinary's `secure_url` (for `authenticated` assets this still needs signing to view). */
  url: string
}

export const imageStore = {
  /** True once all three Cloudinary vars are set — gates the whole feature. */
  isConfigured(): boolean {
    return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
  },

  /** Server-side signed upload of raw bytes as an authenticated (private) image. */
  async upload(
    bytes: Buffer,
    opts: { folder?: string; contentType?: string } = {},
  ): Promise<UploadedImage> {
    ensureConfigured()
    const dataUri = `data:${opts.contentType ?? 'image/png'};base64,${bytes.toString('base64')}`
    const res = await cloudinary.uploader.upload(dataUri, {
      type: 'authenticated',
      resource_type: 'image',
      folder: opts.folder,
    })
    return { publicId: res.public_id, url: res.secure_url }
  },

  /** Reclaim storage when a ticket/attachment is purged (the Free plan suspends on overage). */
  async destroy(publicId: string): Promise<void> {
    ensureConfigured()
    await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image' })
  },

  /**
   * A signature-signed delivery URL for an authenticated asset — the only way the dashboard can
   * render a private attachment. Returns null for an empty/absent public_id.
   */
  signedUrl(publicId: string): string | null {
    if (!publicId) return null
    ensureConfigured()
    return cloudinary.url(publicId, {
      type: 'authenticated',
      resource_type: 'image',
      sign_url: true,
      secure: true,
    })
  },
}
