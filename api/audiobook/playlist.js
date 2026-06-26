import { verifyAuth }                    from './_auth.js'
import { getObject, signUrl, streamToString } from './_r2.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const { chapter } = req.query
  if (!chapter) return res.status(400).json({ error: 'chapter required' })

  let raw
  try {
    const stream = await getObject(`hls/${chapter}/index.m3u8`)
    raw = await streamToString(stream)
  } catch {
    return res.status(404).json({ error: 'Chapter not found' })
  }

  // Bake the token into the key URL so iOS native HLS (which can't set headers)
  // can authenticate the key request. hls.js clients also send it via header.
  const token       = req.headers.authorization?.split(' ')[1] ?? req.query.token
  const keyTokenQs  = token ? `&token=${encodeURIComponent(token)}` : ''

  // Key URI becomes a root-relative path (/api/audiobook/key?...), so it is
  // always same-origin as the page — proxied in dev, same domain in prod.
  // Segment URLs are pre-signed absolute R2 URLs fetched directly by the browser.
  const lines = raw.split('\n')
  const processed = await Promise.all(
    lines.map(line => {
      const t = line.trim()
      if (t.endsWith('.ts')) {
        return signUrl(`hls/${chapter}/${t}`, 3600)
      }
      if (t.includes('__APIBASE__')) {
        // Strip the placeholder, then inject the token inside the quoted key URI
        // (before the closing quote, ahead of any IV= attribute).
        return Promise.resolve(
          line.replace(/__APIBASE__/g, '')
              .replace(/(URI=")([^"]*)(")/, `$1$2${keyTokenQs}$3`)
        )
      }
      return Promise.resolve(line)
    })
  )

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
  res.setHeader('Cache-Control', 'no-store')
  res.send(processed.join('\n'))
}
