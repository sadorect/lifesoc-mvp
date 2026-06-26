/**
 * Generates PWA icons as PNG files into public/.
 * No external dependencies — uses Node.js built-in zlib.
 *
 * Design: dark background (#0d1117) with a blue (#388bfd) shield shape
 * and a white "LS" monogram.
 *
 * Run: node scripts/generate-icons.mjs
 */

import { deflateSync }        from 'zlib'
import { writeFileSync,
         mkdirSync }          from 'fs'
import { join, dirname }      from 'path'
import { fileURLToPath }      from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT       = join(__dirname, '..', 'public')
mkdirSync(OUT, { recursive: true })

// ── CRC32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const t   = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4);  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4);  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

// ── PNG builder ────────────────────────────────────────────────────────────

function makePng(size) {
  const BG  = [13,  17,  23]   // #0d1117
  const BLUE= [56, 139, 253]   // #388bfd
  const WHT = [255,255,255]

  const raw = []

  for (let y = 0; y < size; y++) {
    raw.push(0) // filter: None
    for (let x = 0; x < size; x++) {
      raw.push(...pixel(x, y, size, BG, BLUE, WHT))
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG magic
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function pixel(x, y, s, bg, blue, wht) {
  const cx = s / 2, cy = s / 2

  // Normalised coords [-1, 1]
  const nx = (x - cx) / (s * 0.5)
  const ny = (y - cy) / (s * 0.5)

  // ── Shield shape ──
  // Top: flat edge at ny = -0.78
  // Sides: taper from ±0.62 at top to 0 at bottom point (ny = 0.78)
  const topEdge    = -0.78
  const shieldTip  =  0.78
  const halfWidthAt = (vy) => {
    if (vy < topEdge || vy > shieldTip) return 0
    const t = (vy - topEdge) / (shieldTip - topEdge) // 0..1 top to tip
    return 0.62 * (1 - t * t)   // quadratic taper
  }

  const inShield = Math.abs(nx) < halfWidthAt(ny)

  // ── Rounded corner on shield top ──
  // Top-left and top-right corners get a soft cut
  const hw = halfWidthAt(topEdge + 0.02)
  const cornerR = 0.18
  const inCornerZone = ny < (topEdge + cornerR) &&
                       Math.abs(nx) > (hw - cornerR)
  const cornerDx = Math.abs(nx) - (hw - cornerR)
  const cornerDy = ny - (topEdge + cornerR)
  const inCornerCut = inCornerZone && Math.sqrt(cornerDx*cornerDx + cornerDy*cornerDy) > cornerR

  const onShield = inShield && !inCornerCut

  if (!onShield) return bg

  // ── "LS" monogram, centred in shield ──
  // We draw two simple letterforms in white using pixel-level checks.
  const lx = nx * s * 0.5  // back to pixel space, centred
  const ly = ny * s * 0.5

  const thick = s * 0.055  // stroke thickness
  const lh    = s * 0.28   // letter height
  const lw    = s * 0.18   // letter width

  // "L" — left of centre
  const Lox = -s * 0.17, Loy = -s * 0.01
  const inLvert  = Math.abs(lx - (Lox - lw/2 + thick/2)) < thick/2 && Math.abs(ly - Loy) < lh/2
  const inLhoriz = Math.abs(ly - (Loy + lh/2 - thick/2)) < thick/2 && lx > (Lox - lw/2) && lx < (Lox + lw/2)
  const inL = inLvert || inLhoriz

  // "S" — right of centre (approximated with 3 horizontal bars + 2 diagonals)
  const Sox = s * 0.10, Soy = -s * 0.01
  const St = thick * 0.9
  const Sw = lw * 0.9, Sh = lh * 0.9
  const inStop  = Math.abs(ly - (Soy - Sh/2 + St/2)) < St/2 && Math.abs(lx - Sox) < Sw/2
  const inSmid  = Math.abs(ly - Soy) < St/2               && Math.abs(lx - Sox) < Sw/2
  const inSbot  = Math.abs(ly - (Soy + Sh/2 - St/2)) < St/2 && Math.abs(lx - Sox) < Sw/2
  const inStopL = ly > (Soy - Sh/2 + St)   && ly < Soy - St/2 && lx > (Sox - Sw/2)        && lx < (Sox - Sw/2 + St)
  const inSbotR = ly > (Soy + St/2)         && ly < Soy + Sh/2 - St && lx > (Sox + Sw/2 - St) && lx < (Sox + Sw/2)
  const inS = inStop || inSmid || inSbot || inStopL || inSbotR

  return (inL || inS) ? wht : blue
}

// ── Write icons ────────────────────────────────────────────────────────────

const SIZES = [
  ['icon-192.png',        192],
  ['icon-512.png',        512],
  ['apple-touch-icon.png',180],
]

for (const [name, size] of SIZES) {
  writeFileSync(join(OUT, name), makePng(size))
  console.log(`  ✓ public/${name}  (${size}×${size})`)
}
console.log('\nDone. Run npm run build to bundle them into the PWA.')
