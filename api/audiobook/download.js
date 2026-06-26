import { verifyAuth, clerk } from './_auth.js'
import { signUrl }           from './_r2.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const user        = await clerk.users.getUser(userId)
  const canDownload = user.publicMetadata?.canDownload === true
  if (!canDownload) return res.status(403).json({ error: 'Download not permitted' })

  const { chapter } = req.query
  if (!chapter) return res.status(400).json({ error: 'chapter required' })

  // Signed URL expires in 1 hour — enough time to download but not shareable long-term
  const url = await signUrl(`originals/${chapter}.mp3`, 3600)
  res.json({ url })
}
