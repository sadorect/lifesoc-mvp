/**
 * Step 0: Split the full manuscript into per-chapter text files.
 *
 * Reads ZeroTrust_Audiobook/ZeroTrust_Audio_Manuscript_1.txt and slices it on
 * "Preface.", "Chapter <N>: <Title>.", and "APPENDICES." headings — in that
 * order, matching the flattened chapter list in api/audiobook/_chapters.js
 * one-for-one. Standalone "PART <N>." heading lines are stripped (they have
 * no dedicated audio slot); any part-introduction prose that appears before
 * a "PART <N>." line stays attached to the end of the preceding chapter,
 * exactly where it sits in the manuscript.
 *
 * Output: overwrites ZeroTrust_Audiobook/<chapter-id>.txt for every chapter,
 * ready for scripts/generate-audiobook-tts.mjs.
 *
 * Run: node scripts/split-manuscript.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname }                          from 'path'
import { fileURLToPath }                          from 'url'
import { PARTS }                                  from '../api/audiobook/_chapters.js'

const __dirname     = dirname(fileURLToPath(import.meta.url))
const ROOT          = join(__dirname, '..')
const AUDIOBOOK     = join(ROOT, 'ZeroTrust_Audiobook')
const MANUSCRIPT    = join(AUDIOBOOK, 'ZeroTrust_Audio_Manuscript_1.txt')

const HEADING_RE = /^(Preface\.|Chapter\s+[A-Za-z-]+\s*:\s*.+?\.|APPENDICES\.)\s*$/gm
const PART_LINE_RE = /^PART\s+[A-Za-z-]+\.\s*$/gm

const text = readFileSync(MANUSCRIPT, 'utf8')

const headings = [...text.matchAll(HEADING_RE)]
console.log(`Found ${headings.length} chapter/section headings`)

const flat = PARTS.flatMap(p => p.chapters)
console.log(`Expected ${flat.length} chapters from api/audiobook/_chapters.js`)

if (headings.length !== flat.length) {
  console.error('\n✗ Heading count does not match the chapter list — aborting.')
  console.error('  Headings found:')
  headings.forEach((h, i) => console.error(`    ${i + 1}. ${h[1]}`))
  process.exit(1)
}

let totalChars = 0

headings.forEach((match, i) => {
  const start = match.index
  const end   = i + 1 < headings.length ? headings[i + 1].index : text.length
  const raw   = text.slice(start, end)
  const clean = raw
    .replace(PART_LINE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'

  const chapter  = flat[i]
  const outPath  = join(AUDIOBOOK, `${chapter.id}.txt`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, clean)

  totalChars += clean.length
  console.log(`  ${chapter.id.padEnd(60)} ${String(clean.length).padStart(7)} chars`)
})

console.log('\n─────────────────────────────────────────')
console.log(`Chapters written : ${flat.length}`)
console.log(`Total characters : ${totalChars.toLocaleString()}`)
console.log(`\nNext step: node scripts/generate-audiobook-tts.mjs`)
