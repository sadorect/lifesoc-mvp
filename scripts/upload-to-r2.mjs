/**
 * Step 2: Upload processed HLS files, original MP3s, and keys to Cloudflare R2.
 *
 * R2 bucket layout after upload:
 *   hls/          ← encrypted HLS segments + playlists (served via signed URLs)
 *   originals/    ← original MP3s (served only to users with canDownload flag)
 *   keys/         ← AES key index (read only by the Vercel API, never public)
 *
 * Run: node scripts/upload-to-r2.mjs
 * Requires: hls_output/ and audiobook_keys.json from process-audiobook.mjs
 */

import { S3Client, PutObjectCommand }    from '@aws-sdk/client-s3'
import { createReadStream, readdirSync,
         statSync, existsSync }          from 'fs'
import { join, relative, extname,
         dirname }                       from 'path'
import { fileURLToPath }                 from 'url'
import dotenv                            from 'dotenv'

dotenv.config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const HLS_OUT   = join(ROOT, 'hls_output')
const AUDIOBOOK = join(ROOT, 'ZeroTrust_Audiobook')
const KEYS_FILE = join(ROOT, 'audiobook_keys.json')

// ── preflight ──────────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET', 'R2_ENDPOINT',
]
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}\nCheck your .env.local`)
  process.exit(1)
}
if (!existsSync(HLS_OUT)) {
  console.error('hls_output/ not found. Run process-audiobook.mjs first.')
  process.exit(1)
}
if (!existsSync(KEYS_FILE)) {
  console.error('audiobook_keys.json not found. Run process-audiobook.mjs first.')
  process.exit(1)
}

// ── S3 client (R2 is S3-compatible) ───────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET = process.env.R2_BUCKET

const CONTENT_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts':   'video/mp2t',
  '.mp3':  'audio/mpeg',
  '.json': 'application/json',
  '.key':  'application/octet-stream',
}

function contentType(filepath) {
  return CONTENT_TYPES[extname(filepath).toLowerCase()] ?? 'application/octet-stream'
}

async function put(key, filepath) {
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        createReadStream(filepath),
    ContentType: contentType(filepath),
  }))
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

// ── upload ─────────────────────────────────────────────────────────────────

async function main() {
  // 1. HLS files — skip the local-only enc.key / enc.keyinfo files
  const hlsFiles = walk(HLS_OUT).filter(f => {
    const name = f.split(/[/\\]/).pop()
    return name !== 'enc.key' && name !== 'enc.keyinfo'
  })

  console.log(`\nUploading ${hlsFiles.length} HLS files to R2...`)
  let n = 0
  for (const file of hlsFiles) {
    const key = 'hls/' + relative(HLS_OUT, file).replace(/\\/g, '/')
    await put(key, file)
    n++
    process.stdout.write(`\r  ${n}/${hlsFiles.length}`)
  }
  console.log('  ✓')

  // 2. Original MP3s (for users granted download access)
  const mp3s = walk(AUDIOBOOK).filter(f => extname(f).toLowerCase() === '.mp3')
  console.log(`\nUploading ${mp3s.length} original MP3s to R2...`)
  for (const file of mp3s) {
    const key = 'originals/' + relative(AUDIOBOOK, file).replace(/\\/g, '/')
    process.stdout.write(`  ${relative(AUDIOBOOK, file)} ... `)
    await put(key, file)
    console.log('✓')
  }

  // 3. AES key index — private, only the Vercel API reads this
  console.log('\nUploading key index...')
  await put('keys/audiobook_keys.json', KEYS_FILE)
  console.log('  ✓ keys/audiobook_keys.json')

  console.log('\n─────────────────────────────────────────')
  console.log('Upload complete.')
  console.log('\nNext step: set up Clerk auth (Step 3)')
}

main().catch(err => {
  console.error('\n✗', err.message)
  process.exit(1)
})
