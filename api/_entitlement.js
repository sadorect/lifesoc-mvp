import { getEntitlementRow } from './_store.js'
import { findReviewer } from './_reviewers.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Reads the reader's entitlement server-side and returns a coarse status only. */
export async function getEntitlement(userId) {
  const row = getEntitlementRow(userId)
  if (row?.book_redeemed !== 1) return { status: 'none' }

  // Reviewers never lapse, but only while their code is still configured.
  if (row.access_type === 'reviewer') {
    return { status: findReviewer(row.reviewer_code) ? 'active' : 'none' }
  }

  const redeemedAt = new Date(row.redeemed_at).getTime()
  const expired = Number.isNaN(redeemedAt) || (Date.now() - redeemedAt) >= YEAR_MS
  return { status: expired ? 'expired' : 'active' }
}
