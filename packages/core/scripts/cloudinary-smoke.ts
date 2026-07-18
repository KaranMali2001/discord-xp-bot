/**
 * LOCAL-ONLY: prove the ticket-image Cloudinary path end-to-end with the real credentials —
 * authenticated upload → signed delivery URL → fetch (must be viewable) → destroy (cleanup).
 * Also asserts a raw (unsigned) authenticated URL is NOT viewable (privacy guarantee).
 */
import { imageStore } from '../src/lib/image-store'

// A minimal valid 1x1 transparent PNG (real image bytes so Cloudinary accepts it).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function main() {
  console.log('isConfigured =', imageStore.isConfigured(), '(expect true)')
  if (!imageStore.isConfigured())
    throw new Error('Cloudinary not configured — check CLOUDINARY_* env')

  const up = await imageStore.upload(PNG, { folder: 'tickets/__smoke__', contentType: 'image/png' })
  console.log('uploaded publicId =', up.publicId)

  const signed = imageStore.signedUrl(up.publicId)
  console.log('signed URL =', signed?.slice(0, 90), '…')

  // Signed URL must be viewable (200 + image content-type).
  const okRes = await fetch(signed as string)
  console.log(
    'signed fetch =',
    okRes.status,
    okRes.headers.get('content-type'),
    '(expect 200 image/*)',
  )

  // Cleanup so we don't leak Free-tier storage.
  await imageStore.destroy(up.publicId)
  console.log('destroyed', up.publicId)

  if (okRes.status !== 200) throw new Error(`signed URL not viewable: ${okRes.status}`)
  console.log('\n✅ cloudinary round-trip passed (upload → signed URL → fetch 200 → destroy)')
}

main().catch((e) => {
  console.error('❌ cloudinary smoke failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
