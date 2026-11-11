import './_env.js'
import { randomBytes } from 'node:crypto'
import { db } from './_db.js'
import { getSetting } from './_settings.js'

// Per-reviewer access codes, managed in the admin (table reviewer_code).
// The name is only for attribution. Revoking a code stops new redemptions and
// ends existing access immediately (getEntitlement re-checks it).
// REVIEWER_CODES ("ada:CODE,bola:CODE") is imported once on first boot.

export function normalize(s) {
  return String(s ?? '').toLowerCase().trim()
}

const insert = db.prepare('INSERT OR IGNORE INTO reviewer_code (code, name) VALUES (?, ?)')

if (getSetting('reviewers_imported') !== '1') {
  const pairs = String(process.env.REVIEWER_CODES ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  for (const pair of pairs) {
    const i = pair.indexOf(':')
    const name = i === -1 ? pair : pair.slice(0, i).trim()
    const code = normalize(i === -1 ? pair : pair.slice(i + 1))
    if (code) insert.run(code, name || 'reviewer')
  }
  db.prepare("INSERT OR REPLACE INTO setting (key, value) VALUES ('reviewers_imported', '1')").run()
}

const findStmt = db.prepare('SELECT code, name FROM reviewer_code WHERE code = ? AND revoked_at IS NULL')

/** Returns the active reviewer whose code matches, or null. */
export function findReviewer(code) {
  const c = normalize(code)
  if (!c) return null
  return findStmt.get(c) ?? null
}

export function listReviewers() {
  return db.prepare(`
    SELECT r.code, r.name, r.created_at, r.revoked_at,
           (SELECT count(*) FROM entitlement e WHERE e.reviewer_code = r.code AND e.access_type = 'reviewer') AS redemptions
    FROM reviewer_code r ORDER BY r.revoked_at IS NOT NULL, r.created_at DESC`).all()
}

export function redeemersOf(code) {
  return db.prepare(`SELECT u.id, u.name, u.email, e.redeemed_at FROM entitlement e JOIN "user" u ON u.id = e.user_id
    WHERE e.reviewer_code = ? AND e.access_type = 'reviewer' ORDER BY e.redeemed_at DESC`).all(normalize(code))
}

/** Creates a code for `name`; generates REVIEW-NAME-XXXX unless one is given. */
export function addReviewer(name, code) {
  const clean = String(name ?? '').trim().slice(0, 60)
  if (!clean) throw Object.assign(new Error('Name is required'), { status: 400 })
  const given = normalize(code)
  const slug = clean.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) || 'READER'
  const generated = `REVIEW-${slug}-${randomBytes(3).toString('hex').toUpperCase()}`
  const final = given || normalize(generated)
  if (final.length < 6) throw Object.assign(new Error('Code must be at least 6 characters'), { status: 400 })
  const r = insert.run(final, clean)
  if (!r.changes) throw Object.assign(new Error('That code already exists'), { status: 409 })
  return { code: final, display: given ? String(code).trim() : generated, name: clean }
}

export function setReviewerRevoked(code, revoked) {
  return db.prepare(`UPDATE reviewer_code SET revoked_at = ${revoked ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : 'NULL'} WHERE code = ?`).run(normalize(code)).changes
}
