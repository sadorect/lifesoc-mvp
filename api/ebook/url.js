import { verifyAuth } from '../audiobook/_auth.js'
import { signUrl }    from '../audiobook/_r2.js'

// Returns a short-lived signed URL to the ebook PDF for the reader to load.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const url = await signUrl('ebook/zerotrust.pdf', 3600)
  res.json({ url })
}
