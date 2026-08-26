import { verifyAuth } from './audiobook/_auth.js'
import { getEntitlement } from './_entitlement.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const { status } = await getEntitlement(userId)
  res.json({ status })
}
