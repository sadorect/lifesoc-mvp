import './_env.js'

// Per-reviewer access codes, set in Vercel as REVIEWER_CODES:
//   "ada:REVIEW-ADA-7K2Q,bola:REVIEW-BOLA-M4XP"
// The name is only for attribution in Clerk metadata. Removing a pair revokes
// that reviewer — new redemptions fail and existing access stops immediately.

function normalize(s) {
  return String(s ?? '').toLowerCase().trim()
}

function parseReviewers() {
  return String(process.env.REVIEWER_CODES ?? '')
    .split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const i = pair.indexOf(':')
      return i === -1
        ? { name: pair, code: normalize(pair) }
        : { name: pair.slice(0, i).trim(), code: normalize(pair.slice(i + 1)) }
    })
    .filter(r => r.code)
}

/** Returns the reviewer whose code matches, or null. */
export function findReviewer(code) {
  const c = normalize(code)
  if (!c) return null
  return parseReviewers().find(r => r.code === c) ?? null
}
