// Self-hosted server: the Vercel-style handlers in api/ under Express, plus the
// built frontend from dist/. Apache proxies the whole site here. Vercel ignores
// this file.
//
//   npm run build && PORT=3000 node selfhost/server.js   (from the repo root, where .env lives)
import '../api/_env.js'
import { fileURLToPath } from 'node:url'
import express from 'express'

import chat from '../api/chat.js'
import scan from '../api/scan.js'
import entitlement from '../api/entitlement.js'
import redeemChallenge from '../api/redeem-challenge.js'
import redeem from '../api/redeem.js'
import ebookUrl from '../api/ebook/url.js'
import audiobookChapters from '../api/audiobook/chapters.js'
import audiobookPlaylist from '../api/audiobook/playlist.js'
import audiobookKey from '../api/audiobook/key.js'
import audiobookDownload from '../api/audiobook/download.js'

// Same paths Vercel derives from the file layout in api/.
const routes = {
  '/api/chat': chat,
  '/api/scan': scan,
  '/api/entitlement': entitlement,
  '/api/redeem-challenge': redeemChallenge,
  '/api/redeem': redeem,
  '/api/ebook/url': ebookUrl,
  '/api/audiobook/chapters': audiobookChapters,
  '/api/audiobook/playlist': audiobookPlaylist,
  '/api/audiobook/key': audiobookKey,
  '/api/audiobook/download': audiobookDownload,
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 'loopback')
app.use(express.json({ limit: '1mb' }))

// Uptime probe (AppDash). Deliberately touches no third party.
app.get('/up', (req, res) => res.type('text').send('ok'))

// Handlers check req.method themselves, as they did on Vercel.
for (const [path, handler] of Object.entries(routes)) app.all(path, handler)

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// The built frontend. Hashed bundles are immutable; the service worker, its
// registration script, the manifest and the HTML shell must always revalidate
// or installed PWAs stay pinned to an old build.
const dist = fileURLToPath(new URL('../dist', import.meta.url))
const revalidate = /(^|\/)(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/
app.use(express.static(dist, {
  index: 'index.html',
  setHeaders(res, file) {
    if (file.includes(`${dist}/assets/`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    else if (revalidate.test(file)) res.setHeader('Cache-Control', 'no-cache')
    else res.setHeader('Cache-Control', 'public, max-age=3600')
  },
}))

// Server-handled links (the service worker's navigateFallbackDenylist) never get the shell.
app.use('/download', (req, res) => res.status(404).type('text').send('Not found'))

// SPA fallback, as vercel.json's final rewrite.
app.get('/*splat', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(`${dist}/index.html`)
})

app.use((err, req, res, next) => {
  const status = err.status ?? 500
  // Client errors (e.g. malformed JSON) get one line; server errors the full stack.
  console.error(`[server] ${req.method} ${req.path}:`, status < 500 ? err.message : err)
  if (res.headersSent) return next(err)
  res.status(status).json({ error: err.expose ? err.message : 'Internal server error' })
})

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'
app.listen(port, host, () => console.log(`[server] listening on ${host}:${port}`))
