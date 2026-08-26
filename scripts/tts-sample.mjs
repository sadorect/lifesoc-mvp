/**
 * One-off: render a short passage in a few candidate voices so you can
 * A/B them by ear before committing to the full audiobook run.
 *
 * Run: node scripts/tts-sample.mjs
 * Output: .tts-tmp/samples/<voice>.mp3
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname }  from 'path'
import { fileURLToPath }  from 'url'
import dotenv             from 'dotenv'

dotenv.config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const OUT_DIR   = join(ROOT, '.tts-tmp', 'samples')

const API_KEY = process.env.OPENAI_API_KEY
const MODEL   = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
const VOICES  = ['onyx', 'fable', 'nova', 'echo']

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local.')
  process.exit(1)
}

// First couple paragraphs of Chapter 1 — representative narration tone.
const SAMPLE_PATH = join(ROOT, 'ZeroTrust_Audiobook', 'Part_01_System_Architecture', 'Ch_01_Know_Your_Own_Architecture.txt')
const fullText = readFileSync(SAMPLE_PATH, 'utf8')
const passage = fullText.split(/\n{2,}/).slice(0, 4).join('\n\n').trim()

console.log(`Sample passage (${passage.length} chars):\n"${passage.slice(0, 120)}..."\n`)

mkdirSync(OUT_DIR, { recursive: true })

for (const voice of VOICES) {
  process.stdout.write(`  ${voice} ... `)
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, voice, input: passage, response_format: 'mp3' }),
  })

  if (!res.ok) {
    console.log(`✗  ${res.status} ${await res.text()}`)
    continue
  }

  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(OUT_DIR, `${voice}.mp3`), buf)
  console.log('✓')
}

console.log(`\nSamples written to ${OUT_DIR}`)
console.log('Listen and tell me which voice to use for the full run.')
