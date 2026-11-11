// One-off: copy readers from Clerk into the self-hosted database.
//
//   node scripts/migrate-from-clerk.mjs                       dry run: counts only, writes nothing
//   node scripts/migrate-from-clerk.mjs --csv users.csv       also match password hashes from Clerk's export
//   node scripts/migrate-from-clerk.mjs --csv users.csv --apply
//
// Env: CLERK_SECRET_KEY (the same instance as the live site), DATA_DIR or DB_PATH
// pointing at the database the container uses (selfhost/data by default).
//
// - Users keep their Clerk id, so entitlements and accounts line up.
// - Book access (privateMetadata) and downloads (publicMetadata.canDownload)
//   move to the entitlement table; redeemedAt is kept, so the 365 days continue.
// - Passwords: bcrypt digests from the dashboard's "Export users" CSV
//   (password_digest column). Readers without one use "Forgot password?".
// - Google: an account row with the Google user id, so "Continue with Google"
//   lands on the same reader.
// Re-runnable: existing users are left alone; entitlements are refreshed.
import '../api/_env.js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClerkClient } from '@clerk/backend'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const csvPath = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : null

if (!process.env.CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY is not set.')
  process.exit(1)
}

// Creates Better Auth's tables if this is a fresh database.
const { db } = await import('../api/_db.js')
await import('../api/_auth-server.js')

// ── Clerk export CSV (only the password columns are used) ────────────────────
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.some(Boolean))
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])))
}

const digests = new Map()
if (csvPath) {
  for (const r of parseCsv(readFileSync(csvPath, 'utf8'))) {
    const hasher = (r.password_hasher || 'bcrypt').toLowerCase()
    if (r.id && r.password_digest && hasher === 'bcrypt') digests.set(r.id, r.password_digest)
  }
  console.log(`CSV: ${digests.size} bcrypt password hashes`)
}

// ── Clerk users ──────────────────────────────────────────────────────────────
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const users = []
for (let offset = 0; ; offset += 100) {
  const page = await clerk.users.getUserList({ limit: 100, offset, orderBy: 'created_at' })
  users.push(...page.data)
  if (page.data.length < 100) break
}

const insertUser = db.prepare(`INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES (@id, @name, @email, @emailVerified, @image, @createdAt, @updatedAt)`)
const insertAccount = db.prepare(`INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
  VALUES (@id, @accountId, @providerId, @userId, @password, @createdAt, @updatedAt)`)
const userById = db.prepare('SELECT id FROM "user" WHERE id = ?')
const userByEmail = db.prepare('SELECT id FROM "user" WHERE lower(email) = lower(?)')
const accountExists = db.prepare('SELECT 1 FROM account WHERE userId = ? AND providerId = ?')
const upsertEntitlement = db.prepare(`
  INSERT INTO entitlement (user_id, book_redeemed, redeemed_at, access_type, reviewer, reviewer_code, can_download)
  VALUES (@userId, @bookRedeemed, @redeemedAt, @accessType, @reviewer, @reviewerCode, @canDownload)
  ON CONFLICT (user_id) DO UPDATE SET
    book_redeemed = excluded.book_redeemed, redeemed_at = excluded.redeemed_at,
    access_type = excluded.access_type, reviewer = excluded.reviewer,
    reviewer_code = excluded.reviewer_code, can_download = excluded.can_download,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)

const n = { users: 0, created: 0, skippedExisting: 0, noEmail: 0, emailClash: 0, passwords: 0, google: 0, redeemed: 0, reviewers: 0, downloads: 0 }
const iso = (ms) => new Date(ms ?? Date.now()).toISOString()

const run = db.transaction(() => {
  for (const u of users) {
    n.users++
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0]
    if (!primary) { n.noEmail++; continue }

    const priv = u.privateMetadata ?? {}
    const redeemed = priv.bookRedeemed === true
    const canDownload = u.publicMetadata?.canDownload === true
    if (redeemed) n.redeemed++
    if (priv.accessType === 'reviewer') n.reviewers++
    if (canDownload) n.downloads++

    const exists = userById.get(u.id)
    if (!exists && userByEmail.get(primary.emailAddress)) { n.emailClash++; continue }

    if (!exists) {
      n.created++
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || primary.emailAddress.split('@')[0]
      if (apply) insertUser.run({
        id: u.id, name, email: primary.emailAddress.toLowerCase(),
        emailVerified: primary.verification?.status === 'verified' ? 1 : 0,
        image: u.hasImage ? u.imageUrl : null,
        createdAt: iso(u.createdAt), updatedAt: iso(u.updatedAt),
      })
    } else n.skippedExisting++

    const digest = digests.get(u.id)
    if (digest && !accountExists.get(u.id, 'credential')) {
      n.passwords++
      if (apply) insertAccount.run({ id: randomUUID(), accountId: u.id, providerId: 'credential', userId: u.id, password: digest, createdAt: iso(), updatedAt: iso() })
    }

    const g = u.externalAccounts.find((a) => a.provider === 'oauth_google' || a.provider === 'google')
    if (g && !accountExists.get(u.id, 'google')) {
      n.google++
      if (apply) insertAccount.run({ id: randomUUID(), accountId: g.providerUserId ?? g.externalId, providerId: 'google', userId: u.id, password: null, createdAt: iso(), updatedAt: iso() })
    }

    if (apply && (redeemed || canDownload)) upsertEntitlement.run({
      userId: u.id,
      bookRedeemed: redeemed ? 1 : 0,
      redeemedAt: priv.redeemedAt ?? null,
      accessType: priv.accessType ?? null,
      reviewer: priv.reviewer ?? null,
      reviewerCode: priv.reviewerCode ?? null,
      canDownload: canDownload ? 1 : 0,
    })
  }
})
run()

console.log(apply ? 'APPLIED' : 'DRY RUN (nothing written; add --apply)')
console.table(n)
if (n.emailClash) console.log('emailClash = a different user already has that email here; left untouched for a manual look.')
