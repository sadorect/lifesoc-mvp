/**
 * Step 1: Process all MP3s into HLS + AES-128 encrypted segments.
 *
 * Output layout:
 *   hls_output/
 *     00_Preface/
 *       index.m3u8
 *       seg_0000.ts  (AES-128 encrypted)
 *       seg_0001.ts
 *       ...
 *     Part_01_System_Architecture/Ch_01_.../
 *       index.m3u8
 *       seg_0000.ts
 *       ...
 *   audiobook_keys.json   ← AES keys (hex), never commit this file
 *
 * The key URI baked into each m3u8 is a placeholder (__APIBASE__) that
 * the Vercel API rewrites at serve time, so local dev and production
 * both work without re-processing the audio files.
 *
 * Run: node scripts/process-audiobook.mjs
 */

import { execSync }                                    from 'child_process'
import { writeFileSync, mkdirSync, readdirSync,
         statSync, existsSync }                        from 'fs'
import { join, relative, extname, dirname }            from 'path'
import { randomBytes }                                 from 'crypto'
import { fileURLToPath }                               from 'url'

const __dirname    = dirname(fileURLToPath(import.meta.url))
const ROOT         = join(__dirname, '..')
const AUDIOBOOK    = join(ROOT, 'ZeroTrust_Audiobook')
const HLS_OUT      = join(ROOT, 'hls_output')
const KEYS_FILE    = join(ROOT, 'audiobook_keys.json')

// ── helpers ────────────────────────────────────────────────────────────────

function findMp3s(dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) findMp3s(p, acc)
    else if (extname(name).toLowerCase() === '.mp3') acc.push(p)
  }
  return acc
}

/** Stable chapter ID derived from relative path, forward-slash separated. */
function toChapterId(mp3Path) {
  return relative(AUDIOBOOK, mp3Path)
    .replace(/\\/g, '/')
    .replace(/\.mp3$/i, '')
}

// ── main ───────────────────────────────────────────────────────────────────

const mp3s = findMp3s(AUDIOBOOK)
console.log(`Found ${mp3s.length} MP3 files\n`)

const keys   = {}
const failed = []

for (const mp3 of mp3s) {
  const id     = toChapterId(mp3)
  const outDir = join(HLS_OUT, id)
  mkdirSync(outDir, { recursive: true })

  // Generate a fresh 16-byte AES-128 key for this chapter
  const key         = randomBytes(16)
  const keyPath     = join(outDir, 'enc.key')
  const keyInfoPath = join(outDir, 'enc.keyinfo')
  const m3u8Path    = join(outDir, 'index.m3u8')
  const segPattern  = join(outDir, 'seg_%04d.ts')

  writeFileSync(keyPath, key)

  // __APIBASE__ is replaced by the API at serve time with the real host.
  const keyUri = `__APIBASE__/api/audiobook/key?chapter=${encodeURIComponent(id)}`
  writeFileSync(keyInfoPath, `${keyUri}\n${keyPath}\n`)

  keys[id] = key.toString('hex')

  process.stdout.write(`  ${id} ... `)

  try {
    execSync(
      [
        'ffmpeg', '-y',
        '-i', `"${mp3}"`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_type', 'mpegts',
        '-hls_key_info_file', `"${keyInfoPath}"`,
        '-hls_segment_filename', `"${segPattern}"`,
        `"${m3u8Path}"`,
      ].join(' '),
      { stdio: 'pipe' }
    )
    console.log('✓')
  } catch (err) {
    const msg = err.stderr?.toString().trim().split('\n').pop() ?? err.message
    console.log(`✗  ${msg}`)
    failed.push(id)
  }
}

// Persist keys — keep this file out of git (see .gitignore entry below)
writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2))

console.log('\n─────────────────────────────────────────')
console.log(`Processed : ${mp3s.length - failed.length} / ${mp3s.length}`)
if (failed.length) {
  console.log(`Failed    : ${failed.join(', ')}`)
}
console.log(`Keys file : audiobook_keys.json  ← DO NOT COMMIT`)
console.log(`HLS output: hls_output/`)
console.log('\nNext step : node scripts/upload-to-r2.mjs')
