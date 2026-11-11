// Counts actions for the admin overview. Never stores what was asked.
import { db } from './_db.js'

const insert = db.prepare('INSERT INTO usage_event (user_id, kind) VALUES (?, ?)')

export function logUsage(userId, kind) {
  try { insert.run(userId ?? null, kind) } catch (e) { console.error('[usage]', e.message) }
}
