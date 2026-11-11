// Browser side of the self-hosted sign-in. Same origin as the API, so the
// session cookie rides along on every /api request without any token handling.
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword } = authClient

/** Whether "Continue with Google" is configured on the server. */
export async function getAuthConfig() {
  try {
    const r = await fetch('/api/auth-config')
    return r.ok ? await r.json() : { google: false }
  } catch {
    return { google: false }
  }
}
