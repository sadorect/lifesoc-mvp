import { verifyAuth, clerk } from './_auth.js'
import { PARTS }            from './_chapters.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const user        = await clerk.users.getUser(userId)
  const canDownload = user.publicMetadata?.canDownload === true

  res.json({ parts: PARTS, canDownload })
}
