// Reader feedback & questions: shared queries and notification emails.
import { db } from './_db.js'
import { sendMail } from './_mail.js'

export const TYPES = { feedback: 'Feedback on the book', question: 'Question for the author', problem: 'Problem with the app' }
export const DAILY_LIMIT = 5 // new messages + follow-ups per reader per 24 hours

const base = () => (process.env.BETTER_AUTH_URL || 'https://www.lifesoc.app').replace(/\/$/, '')
const admins = () => String(process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export function repliesFor(ids) {
  if (!ids.length) return {}
  const rows = db.prepare(`SELECT id, message_id, author, body, created_at FROM message_reply
    WHERE message_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids)
  const by = {}
  for (const r of rows) (by[r.message_id] ??= []).push({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at })
  return by
}

export function sentInLastDay(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const m = db.prepare('SELECT count(*) n FROM message WHERE user_id = ? AND created_at >= ?').get(userId, since).n
  const r = db.prepare(`SELECT count(*) n FROM message_reply mr JOIN message m ON m.id = mr.message_id
    WHERE m.user_id = ? AND mr.author = 'reader' AND mr.created_at >= ?`).get(userId, since).n
  return m + r
}

const clip = (s, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** Tells the admin(s) about a new message or follow-up. Failures are logged, never thrown. */
export async function notifyAdmin({ user, type, rating, chapter, body, followUp }) {
  const to = admins()
  if (!to.length) return
  const what = followUp ? 'replied to their message' : `sent ${type === 'feedback' ? 'feedback' : type === 'question' ? 'a question' : 'a problem report'}`
  const details = [
    rating ? `Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : null,
    chapter ? `Chapter: ${chapter}` : null,
  ].filter(Boolean).join('\n')
  try {
    await sendMail({
      to: to.join(', '),
      subject: `LifeSOC: ${user.name || user.email} ${what}`,
      intro: `${user.name || 'A reader'} (${user.email}) ${what}.`,
      quote: `${details ? `${details}\n\n` : ''}${clip(body)}`,
      actionText: 'Open the inbox',
      url: `${base()}/admin?tab=inbox`,
      outro: 'Reply from the admin inbox so the reader gets it by email and in the app.',
    })
  } catch (e) { console.error('[messages] admin notify failed:', e.message) }
}

/** Sends the admin's reply to the reader. Throws if mail can't be sent, so the admin knows. */
export async function notifyReader({ email, name, original, reply }) {
  await sendMail({
    to: email,
    subject: 'Tosin Omojola replied to your message on LifeSOC',
    intro: `Hi ${name || 'there'}, Tosin Omojola has replied to your message:`,
    quote: reply,
    actionText: 'See the conversation',
    url: `${base()}/?messages=1`,
    outro: `You wrote: "${clip(original, 200)}". To respond, open LifeSOC and reply under My messages. (Replies to this email aren't read.)`,
  })
}
