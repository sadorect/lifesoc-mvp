// Admin API (/api/admin/*). Only signed-in, verified accounts listed in
// ADMIN_EMAILS (comma-separated) get through. Every change is written to admin_audit.
import express from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './_auth-server.js'
import { db } from './_db.js'
import { expiryOf, statusOf } from './_entitlement.js'
import { getAllSettings, setSettings } from './_settings.js'
import { listReviewers, redeemersOf, addReviewer, setReviewerRevoked, normalize } from './_reviewers.js'

const DAY = 24 * 60 * 60 * 1000
const admins = () => String(process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

export async function getAdmin(req) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)
  const u = session?.user
  return u && u.emailVerified && admins().includes(String(u.email).toLowerCase()) ? u : null
}

const audit = db.prepare('INSERT INTO admin_audit (admin, action, target, detail) VALUES (?, ?, ?, ?)')
const log = (req, action, target, detail) => audit.run(req.admin.email, action, target ?? null, detail ? JSON.stringify(detail) : null)

const router = express.Router()
router.use(express.json({ limit: '100kb' }))
router.use(async (req, res, next) => {
  req.admin = await getAdmin(req)
  if (!req.admin) return res.status(403).json({ error: 'Admins only' })
  res.setHeader('Cache-Control', 'no-store')
  next()
})
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

router.get('/me', (req, res) => res.json({ admin: true, email: req.admin.email }))

// ── Overview ────────────────────────────────────────────────────────────────
router.get('/overview', (req, res) => {
  const now = Date.now()
  const since = (days) => new Date(now - days * DAY).toISOString()
  const ents = db.prepare('SELECT * FROM entitlement').all()
  const statuses = ents.map(statusOf)
  const count = (sql, ...a) => db.prepare(sql).get(...a).n
  const totals = {
    users: count('SELECT count(*) n FROM "user"'),
    verified: count('SELECT count(*) n FROM "user" WHERE emailVerified = 1'),
    activeAccess: statuses.filter((s) => s === 'active').length,
    expiredAccess: statuses.filter((s) => s === 'expired').length,
    reviewers: ents.filter((e, i) => e.access_type === 'reviewer' && statuses[i] === 'active').length,
    signups7: count('SELECT count(*) n FROM "user" WHERE createdAt >= ?', since(7)),
    signups30: count('SELECT count(*) n FROM "user" WHERE createdAt >= ?', since(30)),
    active7: count('SELECT count(DISTINCT userId) n FROM session WHERE updatedAt >= ?', since(7)),
    chat7: count("SELECT count(*) n FROM usage_event WHERE kind = 'chat' AND at >= ?", since(7)),
    scan7: count("SELECT count(*) n FROM usage_event WHERE kind = 'scan' AND at >= ?", since(7)),
    expiringSoon: ents.filter((e, i) => statuses[i] === 'active' && expiryOf(e) && expiryOf(e) - now < 30 * DAY).length,
  }
  // 30 daily buckets (UTC dates), oldest first.
  const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * DAY).toISOString().slice(0, 10))
  const byDay = (rows) => { const m = Object.fromEntries(rows.map((r) => [r.d, r.n])); return days.map((d) => m[d] ?? 0) }
  const series = {
    days,
    signups: byDay(db.prepare('SELECT substr(createdAt,1,10) d, count(*) n FROM "user" WHERE createdAt >= ? GROUP BY d').all(days[0])),
    redemptions: byDay(db.prepare("SELECT substr(at,1,10) d, count(*) n FROM usage_event WHERE kind = 'redeem' AND at >= ? GROUP BY d").all(days[0])),
    chat: byDay(db.prepare("SELECT substr(at,1,10) d, count(*) n FROM usage_event WHERE kind = 'chat' AND at >= ? GROUP BY d").all(days[0])),
    scan: byDay(db.prepare("SELECT substr(at,1,10) d, count(*) n FROM usage_event WHERE kind = 'scan' AND at >= ? GROUP BY d").all(days[0])),
  }
  const recent = db.prepare('SELECT at, admin, action, target, detail FROM admin_audit ORDER BY id DESC LIMIT 15').all()
  res.json({ totals, series, recent })
})

// ── Users ───────────────────────────────────────────────────────────────────
function userRows(where = '', params = []) {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.emailVerified, u.image, u.createdAt,
      (SELECT group_concat(providerId) FROM account a WHERE a.userId = u.id) AS providers,
      (SELECT max(updatedAt) FROM session s WHERE s.userId = u.id) AS lastSeen,
      (SELECT count(*) FROM session s WHERE s.userId = u.id AND s.expiresAt > ?) AS sessions,
      (SELECT count(*) FROM usage_event ev WHERE ev.user_id = u.id AND ev.kind IN ('chat','scan') AND ev.at >= ?) AS ai30,
      e.book_redeemed, e.redeemed_at, e.access_type, e.reviewer, e.reviewer_code, e.can_download, e.access_until
    FROM "user" u LEFT JOIN entitlement e ON e.user_id = u.id
    ${where} ORDER BY u.createdAt DESC`).all(new Date().toISOString(), new Date(Date.now() - 30 * DAY).toISOString(), ...params)
  return rows.map((r) => {
    const ent = r.book_redeemed == null ? null : r
    const exp = expiryOf(ent)
    return {
      id: r.id, name: r.name, email: r.email, emailVerified: !!r.emailVerified, image: r.image, createdAt: r.createdAt,
      providers: (r.providers ?? '').split(',').filter(Boolean), lastSeen: r.lastSeen, sessions: r.sessions, ai30: r.ai30,
      access: {
        status: statusOf(ent), redeemedAt: r.redeemed_at ?? null, expiresAt: exp ? exp.toISOString() : null,
        type: r.access_type ?? null, reviewer: r.reviewer ?? null, canDownload: r.can_download === 1, extended: !!r.access_until,
      },
      isAdmin: admins().includes(String(r.email).toLowerCase()),
    }
  })
}

router.get('/users', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  res.json({ users: q ? userRows('WHERE lower(u.email) LIKE ? OR lower(u.name) LIKE ?', [`%${q}%`, `%${q}%`]) : userRows() })
})

function findUser(id) {
  const u = db.prepare('SELECT id, email, name FROM "user" WHERE id = ?').get(id)
  if (!u) throw Object.assign(new Error('User not found'), { status: 404 })
  return u
}

const ensureRow = db.prepare('INSERT OR IGNORE INTO entitlement (user_id) VALUES (?)')

router.post('/users/:id/access', wrap(async (req, res) => {
  const u = findUser(req.params.id)
  const { action } = req.body ?? {}
  const days = Math.max(1, Math.min(3650, Number(req.body?.days) || 0))
  const nowIso = new Date().toISOString()
  ensureRow.run(u.id)
  const row = db.prepare('SELECT * FROM entitlement WHERE user_id = ?').get(u.id)
  if (action === 'grant') {
    // A fresh year (or `days`) from today, as if they had redeemed now.
    db.prepare(`UPDATE entitlement SET book_redeemed = 1, redeemed_at = ?, access_type = 'granted', reviewer = NULL, reviewer_code = NULL,
      access_until = ?, updated_at = ? WHERE user_id = ?`).run(nowIso, new Date(Date.now() + (req.body?.days ? days : 365) * DAY).toISOString(), nowIso, u.id)
  } else if (action === 'extend') {
    if (row.book_redeemed !== 1) throw Object.assign(new Error('No access to extend; grant it instead'), { status: 400 })
    const current = expiryOf(row)
    if (!current) throw Object.assign(new Error('Reviewer access never expires'), { status: 400 })
    const from = Math.max(Date.now(), current.getTime())
    db.prepare('UPDATE entitlement SET access_until = ?, updated_at = ? WHERE user_id = ?').run(new Date(from + days * DAY).toISOString(), nowIso, u.id)
  } else if (action === 'revoke') {
    db.prepare('UPDATE entitlement SET book_redeemed = 0, access_until = NULL, updated_at = ? WHERE user_id = ?').run(nowIso, u.id)
  } else if (action === 'downloads') {
    db.prepare('UPDATE entitlement SET can_download = ?, updated_at = ? WHERE user_id = ?').run(req.body?.value ? 1 : 0, nowIso, u.id)
  } else {
    return res.status(400).json({ error: 'Unknown action' })
  }
  log(req, `access.${action}`, u.email, action === 'extend' || action === 'grant' ? { days: req.body?.days ?? 365 } : action === 'downloads' ? { value: !!req.body?.value } : null)
  res.json({ user: userRows('WHERE u.id = ?', [u.id])[0] })
}))

router.post('/users/:id/resend-verification', wrap(async (req, res) => {
  const u = findUser(req.params.id)
  await auth.api.sendVerificationEmail({ body: { email: u.email, callbackURL: '/' } })
  log(req, 'email.verification', u.email)
  res.json({ ok: true })
}))

router.post('/users/:id/password-reset', wrap(async (req, res) => {
  const u = findUser(req.params.id)
  await auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: '/reset-password' } })
  log(req, 'email.password_reset', u.email)
  res.json({ ok: true })
}))

router.post('/users/:id/sign-out', (req, res) => {
  const u = findUser(req.params.id)
  const n = db.prepare('DELETE FROM session WHERE userId = ?').run(u.id).changes
  log(req, 'sessions.revoke', u.email, { sessions: n })
  res.json({ ok: true, sessions: n })
})

router.delete('/users/:id', (req, res) => {
  const u = findUser(req.params.id)
  if (u.id === req.admin.id) return res.status(400).json({ error: "You can't delete your own account here" })
  db.transaction(() => {
    db.prepare('DELETE FROM entitlement WHERE user_id = ?').run(u.id)
    db.prepare('UPDATE usage_event SET user_id = NULL WHERE user_id = ?').run(u.id)
    db.prepare('DELETE FROM verification WHERE value LIKE ?').run(`%${u.id}%`)
    db.prepare('DELETE FROM "user" WHERE id = ?').run(u.id) // sessions and accounts cascade
  })()
  log(req, 'user.delete', u.email)
  res.json({ ok: true })
})

// ── Reviewer codes ──────────────────────────────────────────────────────────
router.get('/reviewers', (req, res) => res.json({
  reviewers: listReviewers().map((r) => ({ ...r, redeemers: redeemersOf(r.code) })),
}))

router.post('/reviewers', (req, res) => {
  const r = addReviewer(req.body?.name, req.body?.code)
  log(req, 'reviewer.add', r.name, { code: r.display })
  res.json(r)
})

for (const op of ['revoke', 'restore']) {
  router.post(`/reviewers/:code/${op}`, (req, res) => {
    const changed = setReviewerRevoked(req.params.code, op === 'revoke')
    if (!changed) return res.status(404).json({ error: 'Code not found' })
    log(req, `reviewer.${op}`, normalize(req.params.code))
    res.json({ ok: true })
  })
}

// ── Settings ────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => res.json({ settings: getAllSettings(), envBookCodeSet: !!process.env.BOOK_ACCESS_CODE }))

router.put('/settings', (req, res) => {
  const b = req.body ?? {}
  const next = {}
  if ('signups_paused' in b) next.signups_paused = b.signups_paused ? '1' : '0'
  if ('announcement' in b) next.announcement = String(b.announcement ?? '').trim().slice(0, 300)
  if ('book_access_code' in b) next.book_access_code = String(b.book_access_code ?? '').trim().slice(0, 60)
  setSettings(next)
  log(req, 'settings.update', null, { ...next, ...(next.book_access_code ? { book_access_code: '(changed)' } : {}) })
  res.json({ settings: getAllSettings() })
})

router.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500
  if (status >= 500) console.error('[admin]', err)
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message })
})

export default router
