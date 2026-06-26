import { verifyAuth }               from './_auth.js'
import { getObject, streamToString } from './_r2.js'

// Cache keys in memory for the lifetime of this function instance
let keysCache = null

async function getKeys() {
  if (keysCache) return keysCache
  const stream = await getObject('keys/audiobook_keys.json')
  keysCache = JSON.parse(await streamToString(stream))
  return keysCache
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const { chapter } = req.query
  if (!chapter) return res.status(400).json({ error: 'chapter required' })

  const keys   = await getKeys()
  const keyHex = keys[chapter]
  if (!keyHex) return res.status(404).json({ error: 'Chapter not found' })

  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-store')
  res.send(Buffer.from(keyHex, 'hex'))
}
