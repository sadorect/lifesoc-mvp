import { clerk } from './audiobook/_auth.js'
import { findReviewer } from './_reviewers.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Reads privateMetadata server-side and returns a coarse status only. */
export async function getEntitlement(userId) {
  const user = await clerk.users.getUser(userId)
  const meta = user.privateMetadata ?? {}

  if (meta.bookRedeemed !== true) return { status: 'none' }

  // Reviewers never lapse, but only while their code is still configured.
  if (meta.accessType === 'reviewer') {
    return { status: findReviewer(meta.reviewerCode) ? 'active' : 'none' }
  }

  const redeemedAt = new Date(meta.redeemedAt).getTime()
  const expired = Number.isNaN(redeemedAt) || (Date.now() - redeemedAt) >= YEAR_MS
  return { status: expired ? 'expired' : 'active' }
}
