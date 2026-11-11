import '../_env.js'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../_auth-server.js'

/**
 * Reads the session cookie. Returns the userId, or sends 401 and returns null.
 * The cookie is same-origin, so iOS native HLS sends it on playlist and key
 * requests too: no token in URLs any more.
 */
export async function verifyAuth(req, res) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (session?.user?.id) return session.user.id
  } catch (e) {
    console.error('[auth] getSession failed:', e.message)
  }
  res.status(401).json({ error: 'Not signed in' })
  return null
}
