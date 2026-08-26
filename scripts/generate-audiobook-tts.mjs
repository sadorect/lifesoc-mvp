/**
 * Step 0.5: Generate chapter mp3s from the split chapter text via OpenAI TTS.
 *
 * Reads ZeroTrust_Audiobook/<chapter-id>.txt (produced by split-manuscript.mjs),
 * chunks each chapter to stay under the TTS input limit, synthesizes each
 * chunk with the OpenAI Audio Speech API, and stitches the chunks back into
 * one mp3 per chapter with ffmpeg (same layout/paths process-audiobook.mjs
 * already expects, so nothing downstream needs to change).
 *
 * Requires: OPENAI_API_KEY in .env.local, ffmpeg on PATH.
 * Run: node scripts/generate-audiobook-tts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join, dirname }        from 'path'
import { execSync }             from 'child_process'
import { fileURLToPath }        from 'url'
import dotenv                   from 'dotenv'
import { PARTS }                from '../api/audiobook/_chapters.js'

dotenv.config({ path: '.env.local' })

const __dirname  = dirname(fileURLToPath(import.meta.url))
const ROOT       = join(__dirname, '..')
const AUDIOBOOK  = join(ROOT, 'ZeroTrust_Audiobook')
const TMP_ROOT   = join(ROOT, '.tts-tmp')

const API_KEY = process.env.OPENAI_API_KEY
const MODEL   = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
const VOICE   = process.env.OPENAI_TTS_VOICE || 'onyx'
const MAX_CHUNK_CHARS = 3500

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY. Add it to .env.local and re-run.')
  process.exit(1)
}

// ── chunking ───────────────────────────────────────────────────────────────

/** Greedily packs paragraphs into <= MAX_CHUNK_CHARS chunks, splitting an
 *  oversized paragraph on sentence boundaries if it alone exceeds the limit. */
function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const chunks = []
  let current = ''

  const pushCurrent = () => { if (current) { chunks.push(current.trim()); current = '' } }

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para
    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate
      continue
    }
    pushCurrent()
    if (para.length <= MAX_CHUNK_CHARS) {
      current = para
      continue
    }
    // Paragraph itself is too long — split on sentences.
    const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para]
    let sentenceChunk = ''
    for (const sentence of sentences) {
      const next = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence
      if (next.length > MAX_CHUNK_CHARS) {
        if (sentenceChunk) chunks.push(sentenceChunk.trim())
        sentenceChunk = sentence
      } else {
        sentenceChunk = next
      }
    }
    if (sentenceChunk) chunks.push(sentenceChunk.trim())
  }
  pushCurrent()
  return chunks
}

// ── OpenAI TTS ─────────────────────────────────────────────────────────────

async function synthesize(text, attempt = 1) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: 'mp3' }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise(r => setTimeout(r, 1500 * attempt))
      return synthesize(text, attempt + 1)
    }
    throw new Error(`TTS request failed (${res.status}): ${body.slice(0, 300)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// ── per-chapter pipeline ───────────────────────────────────────────────────

async function processChapter(chapter) {
  const txtPath = join(AUDIOBOOK, `${chapter.id}.txt`)
  if (!existsSync(txtPath)) {
    console.log(`  ${chapter.id} ... skipped (no .txt found)`)
    return { id: chapter.id, ok: false, reason: 'missing .txt' }
  }

  const text   = readFileSync(txtPath, 'utf8')
  const chunks = chunkText(text)
  const mp3Path = join(AUDIOBOOK, `${chapter.id}.mp3`)
  const tmpDir  = join(TMP_ROOT, chapter.id.replace(/\//g, '__'))
  mkdirSync(tmpDir, { recursive: true })

  process.stdout.write(`  ${chapter.id} (${chunks.length} chunk${chunks.length > 1 ? 's' : ''}) ... `)

  try {
    const chunkPaths = []
    for (let i = 0; i < chunks.length; i++) {
      const audio = await synthesize(chunks[i])
      const p = join(tmpDir, `chunk_${String(i).padStart(3, '0')}.mp3`)
      writeFileSync(p, audio)
      chunkPaths.push(p)
    }

    mkdirSync(dirname(mp3Path), { recursive: true })

    if (chunkPaths.length === 1) {
      writeFileSync(mp3Path, readFileSync(chunkPaths[0]))
    } else {
      const listPath = join(tmpDir, 'concat.txt')
      const listBody = chunkPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
      writeFileSync(listPath, listBody)
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${mp3Path}"`,
        { stdio: 'pipe' }
      )
    }

    rmSync(tmpDir, { recursive: true, force: true })
    console.log('✓')
    return { id: chapter.id, ok: true }
  } catch (err) {
    console.log(`✗  ${err.message}`)
    return { id: chapter.id, ok: false, reason: err.message }
  }
}

// ── main ───────────────────────────────────────────────────────────────────

const flat = PARTS.flatMap(p => p.chapters)
console.log(`Generating audio for ${flat.length} chapters (model: ${MODEL}, voice: ${VOICE})\n`)

const results = []
for (const chapter of flat) {
  results.push(await processChapter(chapter))
}

rmSync(TMP_ROOT, { recursive: true, force: true })

const failed = results.filter(r => !r.ok)
console.log('\n─────────────────────────────────────────')
console.log(`Generated : ${results.length - failed.length} / ${results.length}`)
if (failed.length) {
  console.log('Failed    :')
  failed.forEach(f => console.log(`  - ${f.id}: ${f.reason}`))
  process.exit(1)
}
console.log('\nNext step: node scripts/process-audiobook.mjs')
