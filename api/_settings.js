// Site settings editable in the admin. Values are strings in the `setting` table.
import { db } from './_db.js'

const DEFAULTS = {
  signups_paused: '0',   // '1' blocks new accounts (email and Google); existing readers can still sign in
  announcement: '',      // shown as a banner on the sign-in screen and in the app when non-empty
  book_access_code: '',  // overrides BOOK_ACCESS_CODE when set
  book_url: '',          // where /book redirects (e.g. the Amazon listing); QR codes point at /book
}

const getStmt = db.prepare('SELECT value FROM setting WHERE key = ?')
const setStmt = db.prepare(`INSERT INTO setting (key, value) VALUES (?, ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)

export function getSetting(key) {
  return getStmt.get(key)?.value ?? DEFAULTS[key] ?? ''
}

export function getAllSettings() {
  return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, getSetting(k)]))
}

export function setSettings(values) {
  const tx = db.transaction((entries) => { for (const [k, v] of entries) setStmt.run(k, String(v)) })
  tx(Object.entries(values).filter(([k]) => k in DEFAULTS))
}

export function getBookAccessCode() {
  return getSetting('book_access_code') || process.env.BOOK_ACCESS_CODE || ''
}

export const signupsPaused = () => getSetting('signups_paused') === '1'

/** Accepts only absolute http(s) URLs; returns the normalised URL or throws. */
export function cleanUrl(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return ''
  let u
  try { u = new URL(v) } catch { throw Object.assign(new Error('Enter a full link starting with https://'), { status: 400 }) }
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('The link must start with https:// or http://'), { status: 400 })
  if (v.length > 2000) throw Object.assign(new Error('That link is too long'), { status: 400 })
  return u.toString()
}
