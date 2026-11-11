// Reader side of feedback & questions (/api/messages/*). Signed-in readers only,
// with or without book access. A reader only ever sees their own messages.
import express from 'express'
import { verifyAuth } from './audiobook/_auth.js'
import { auth } from './_auth-server.js'
import { fromNodeHeaders } from 'better-auth/node'
import { db } from './_db.js'
import { PARTS } from './audiobook/_chapters.js'
import { TYPES, DAILY_LIMIT, repliesFor, sentInLastDay, notifyAdmin } from './_messages.js'

const router = express.Router()
router.use(express.json({ limit: '32kb' }))
router.use(async (req, res, next) => {
  const userId = await verifyAuth(req, res)
  if (!userId) return
  req.userId = userId
  res.setHeader('Cache-Control', 'no-store')
  next()
})
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const bad = (res, error, status = 400) => res.status(status).json({ error })

async function currentUser(req) {
  const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  return s.user
}

// Chapter titles for the optional "which chapter?" picker (the table of contents isn't secret).
router.get('/chapters', (req, res) => {
  res.json({ chapters: PARTS.flatMap((p) => p.chapters.map((c) => (p.chapters.length === 1 && p.title === c.title ? c.title : `${p.title.replace(/^Part (\d+):.*/, 'Part $1')} · ${c.title}`))) })
})

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM message WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100').all(req.userId)
  const replies = repliesFor(rows.map((r) => r.id))
  const messages = rows.map((m) => {
    const thread = replies[m.id] ?? []
    const lastAdmin = [...thread].reverse().find((r) => r.author === 'admin')
    return {
      id: m.id, type: m.type, rating: m.rating, chapter: m.chapter, body: m.body, status: m.status, createdAt: m.created_at,
      replies: thread, unread: !!lastAdmin && (!m.reader_seen_at || lastAdmin.createdAt > m.reader_seen_at),
    }
  })
  res.json({ messages, unread: messages.filter((m) => m.unread).length, remainingToday: Math.max(0, DAILY_LIMIT - sentInLastDay(req.userId)) })
})

router.post('/', wrap(async (req, res) => {
  const { type, rating, chapter, body, meta } = req.body ?? {}
  if (!TYPES[type]) return bad(res, 'Choose what kind of message this is')
  const text = String(body ?? '').trim()
  if (text.length < 5) return bad(res, 'Please write a little more')
  if (text.length > 4000) return bad(res, 'Please keep it under 4,000 characters')
  const stars = type === 'feedback' && rating ? Math.round(Number(rating)) : null
  if (stars !== null && !(stars >= 1 && stars <= 5)) return bad(res, 'Rating must be 1 to 5 stars')
  if (sentInLastDay(req.userId) >= DAILY_LIMIT) return bad(res, `You can send ${DAILY_LIMIT} messages a day. Please try again tomorrow.`, 429)

  const ch = String(chapter ?? '').trim().slice(0, 200) || null
  const info = type === 'problem' ? JSON.stringify({ ua: String(req.headers['user-agent'] ?? '').slice(0, 300), ...(meta && typeof meta === 'object' ? { screen: String(meta.screen ?? '').slice(0, 40), standalone: !!meta.standalone } : {}) }) : null
  const r = db.prepare('INSERT INTO message (user_id, type, rating, chapter, body, meta, reader_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.userId, type, stars, ch, text, info, new Date().toISOString())
  notifyAdmin({ user: await currentUser(req), type, rating: stars, chapter: ch, body: text })
  res.json({ ok: true, id: r.lastInsertRowid })
}))

router.post('/:id/reply', wrap(async (req, res) => {
  const m = db.prepare('SELECT * FROM message WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId)
  if (!m) return bad(res, 'Message not found', 404)
  const text = String(req.body?.body ?? '').trim()
  if (text.length < 2) return bad(res, 'Please write a reply')
  if (text.length > 4000) return bad(res, 'Please keep it under 4,000 characters')
  if (sentInLastDay(req.userId) >= DAILY_LIMIT) return bad(res, `You can send ${DAILY_LIMIT} messages a day. Please try again tomorrow.`, 429)
  const now = new Date().toISOString()
  db.transaction(() => {
    db.prepare("INSERT INTO message_reply (message_id, author, body) VALUES (?, 'reader', ?)").run(m.id, text)
    db.prepare("UPDATE message SET status = 'new', updated_at = ?, reader_seen_at = ? WHERE id = ?").run(now, now, m.id)
  })()
  notifyAdmin({ user: await currentUser(req), type: m.type, body: text, followUp: true })
  res.json({ ok: true })
}))

router.post('/seen', (req, res) => {
  db.prepare('UPDATE message SET reader_seen_at = ? WHERE user_id = ?').run(new Date().toISOString(), req.userId)
  res.json({ ok: true })
})

router.use((err, req, res, next) => {
  console.error('[messages]', err)
  res.status(500).json({ error: 'Something went wrong' })
})

export default router
