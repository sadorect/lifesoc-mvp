import { verifyAuth } from './_auth.js'
import { canDownload as readerCanDownload } from '../_store.js'
import { PARTS }            from './_chapters.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const canDownload = readerCanDownload(userId)

  res.json({ parts: PARTS, canDownload })
}
