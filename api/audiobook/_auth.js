import './_env.js'
import { createClerkClient, verifyToken } from '@clerk/backend'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

/** Verifies the Bearer token. Returns userId string or sends 401 and returns null. */
export async function verifyAuth(req, res) {
  // Header for hls.js (Chrome/Firefox/Android); query param for native HLS (iOS Safari,
  // which can't set request headers on media/key requests).
  const token = req.headers.authorization?.split(' ')[1] ?? req.query.token
  if (!token) {
    res.status(401).json({ error: 'No token' })
    return null
  }
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
      authorizedParties: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://lifesoc-pwa.vercel.app',
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      ].filter(Boolean),
    })
    return payload.sub
  } catch (e) {
    console.error('[auth] verifyToken failed:', e.message)
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}

export { clerk }
