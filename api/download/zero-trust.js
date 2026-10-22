// Temporary public download of the full Zero Trust PDF (print edition with covers).
// Deliberately unauthenticated: it is a share-by-link, not the reader. After
// EXPIRES_AT it returns 410, and the origin copy is deleted at the same time.
// The PDF is not in this (public) repo; it is streamed from the origin below.

const ORIGIN_URL = 'https://dashboard.sadorect.com/downloads/zt-bc4b41f59cf646e9623a19f228f72b1d.pdf'
const EXPIRES_AT = Date.parse('2026-10-29T23:59:59Z')
const FILENAME   = 'ZeroTrust_Complete_Book_with_Covers_6x9.pdf'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()

  // Never let a CDN keep a copy past the expiry.
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')

  if (Date.now() > EXPIRES_AT) return res.status(410).send('This download link has expired.')

  const upstream = await fetch(ORIGIN_URL)
  if (!upstream.ok) return res.status(502).send('Download temporarily unavailable.')

  const body = Buffer.from(await upstream.arrayBuffer())
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${FILENAME}"`)
  res.setHeader('Content-Length', body.length)
  if (req.method === 'HEAD') return res.status(200).end()
  res.status(200).send(body)
}
