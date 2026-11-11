// Reader entitlements, stored in our own database (formerly Clerk metadata).
import { db } from './_db.js'

const getStmt = db.prepare('SELECT * FROM entitlement WHERE user_id = ?')

/** Returns the raw entitlement row, or null if the reader never redeemed. */
export function getEntitlementRow(userId) {
  return getStmt.get(userId) ?? null
}

export function canDownload(userId) {
  return getEntitlementRow(userId)?.can_download === 1
}

const upsertReviewer = db.prepare(`
  INSERT INTO entitlement (user_id, book_redeemed, redeemed_at, access_type, reviewer, reviewer_code, can_download)
  VALUES (@userId, 1, @redeemedAt, 'reviewer', @reviewer, @reviewerCode, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    book_redeemed = 1, redeemed_at = excluded.redeemed_at, access_type = 'reviewer',
    reviewer = excluded.reviewer, reviewer_code = excluded.reviewer_code, can_download = 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`)

/** Reviewer code: indefinite access (while the code stays listed) plus downloads. */
export function grantReviewer(userId, reviewer) {
  upsertReviewer.run({
    userId,
    redeemedAt: new Date().toISOString(),
    reviewer: reviewer.name,
    reviewerCode: reviewer.code,
  })
}

// A normal redemption clears reviewer fields but, as with Clerk, leaves
// can_download alone (it was publicMetadata, which the old code never reset).
const upsertReader = db.prepare(`
  INSERT INTO entitlement (user_id, book_redeemed, redeemed_at)
  VALUES (@userId, 1, @redeemedAt)
  ON CONFLICT (user_id) DO UPDATE SET
    book_redeemed = 1, redeemed_at = excluded.redeemed_at,
    access_type = NULL, reviewer = NULL, reviewer_code = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`)

/** Book code + question: 365 days from now. */
export function grantReader(userId) {
  upsertReader.run({ userId, redeemedAt: new Date().toISOString() })
}
