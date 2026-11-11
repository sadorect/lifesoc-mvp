import { getEntitlementRow } from './_store.js'
import { findReviewer } from './_reviewers.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** When a reader's access ends: a manual extension if set, else 365 days from redemption. */
export function expiryOf(row) {
  if (!row || row.book_redeemed !== 1) return null
  if (row.access_type === 'reviewer') return null // never lapses while the code is active
  if (row.access_until) return new Date(row.access_until)
  const t = new Date(row.redeemed_at).getTime()
  return Number.isNaN(t) ? new Date(0) : new Date(t + YEAR_MS)
}

/** Status from a raw entitlement row: none | active | expired. */
export function statusOf(row) {
  if (row?.book_redeemed !== 1) return 'none'
  // Reviewers never lapse, but only while their code is still active.
  if (row.access_type === 'reviewer') return findReviewer(row.reviewer_code) ? 'active' : 'none'
  return expiryOf(row) > new Date() ? 'active' : 'expired'
}

/** Reads the reader's entitlement server-side and returns a coarse status only. */
export async function getEntitlement(userId) {
  return { status: statusOf(getEntitlementRow(userId)) }
}
