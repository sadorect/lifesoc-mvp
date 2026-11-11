import { useEffect, useState } from 'react'
import { signIn, signUp, requestPasswordReset, resetPassword, getAuthConfig } from '../lib/auth-client.js'
import LegalLinks from './LegalLinks.jsx'

// Sign-in, sign-up, forgot and reset password, over the book cover.
// Reset links land on /reset-password?token=… (the server serves the app shell there).
export default function SignInScreen() {
  const params = new URLSearchParams(window.location.search)
  const resetToken = window.location.pathname === '/reset-password' ? params.get('token') : null
  const linkError = params.get('error')

  const [mode, setMode]         = useState(resetToken ? 'reset' : 'signin') // signin | signup | forgot | sent | reset
  const [sentWhat, setSentWhat] = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(() => describeLinkError(linkError, resetToken))
  const [busy, setBusy]         = useState(false)
  const [google, setGoogle]     = useState(false)

  useEffect(() => { getAuthConfig().then(c => setGoogle(!!c.google)) }, [])

  const go = next => { setMode(next); setError(null); setPassword('') }

  const clearUrl = () => window.history.replaceState(null, '', '/')

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        const { error } = await signIn.email({ email, password, callbackURL: '/' })
        if (error?.code === 'EMAIL_NOT_VERIFIED') {
          setSentWhat('We sent you a new link to confirm your email. Open it to finish signing in.')
          setMode('sent')
        } else if (error) {
          setError(error.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Wrong email or password.')
        } else {
          clearUrl()
        }
      } else if (mode === 'signup') {
        const { error } = await signUp.email({ name: name.trim() || email.split('@')[0], email, password, callbackURL: '/' })
        if (error) {
          setError(error.code === 'USER_ALREADY_EXISTS' || error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
            ? 'There is already an account with that email. Sign in instead.'
            : error.message || 'Could not create the account.')
        } else {
          setSentWhat(`We sent a link to ${email}. Open it to confirm your email and sign in.`)
          setMode('sent')
        }
      } else if (mode === 'forgot') {
        await requestPasswordReset({ email, redirectTo: '/reset-password' })
        setSentWhat(`If there is an account for ${email}, we've sent it a link to choose a new password.`)
        setMode('sent')
      } else if (mode === 'reset') {
        const { error } = await resetPassword({ newPassword: password, token: resetToken })
        if (error) {
          setError('That reset link has expired or was already used. Ask for a new one.')
        } else {
          clearUrl()
          setSentWhat('Your password has been changed. Sign in with the new one.')
          setMode('done')
        }
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const withGoogle = () => signIn.social({ provider: 'google', callbackURL: '/' })

  return (
    <div style={S.backdrop}>
      <div style={S.card}>
        <p style={S.brand}>
          <img src="/logo-mark.svg" alt="" width="28" height="28" />
          <span>Life<span style={{ color: 'var(--blue)' }}>SOC</span></span>
        </p>

        {(mode === 'sent' || mode === 'done') ? (
          <>
            <p style={S.title}>{mode === 'sent' ? 'Check your email' : 'Password changed'}</p>
            <p style={S.text}>{sentWhat}</p>
            <button type="button" style={S.link} onClick={() => go('signin')}>Back to sign in</button>
          </>
        ) : (
          <form onSubmit={submit} style={S.form}>
            <p style={S.title}>{TITLES[mode]}</p>
            {mode === 'forgot' && <p style={S.text}>Enter your email and we'll send you a link to choose a new password.</p>}

            {google && (mode === 'signin' || mode === 'signup') && (
              <>
                <button type="button" style={S.google} onClick={withGoogle}>
                  <GoogleMark /> Continue with Google
                </button>
                <div style={S.or}><span style={S.orLine} />or<span style={S.orLine} /></div>
              </>
            )}

            {mode === 'signup' && (
              <Field label="Name" value={name} onChange={setName} autoComplete="name" />
            )}
            {mode !== 'reset' && (
              <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            )}
            {mode !== 'forgot' && (
              <Field
                label={mode === 'reset' ? 'New password' : 'Password'}
                type="password" value={password} onChange={setPassword} required minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                hint={mode === 'signin' ? null : 'At least 8 characters.'}
              />
            )}

            {error && <p style={S.error} role="alert">{error}</p>}

            <button type="submit" style={S.button} disabled={busy}>
              {busy ? 'Please wait…' : BUTTONS[mode]}
            </button>

            {mode === 'signin' && (
              <>
                <button type="button" style={S.link} onClick={() => go('forgot')}>Forgot password?</button>
                <p style={S.switch}>New here? <button type="button" style={S.inlineLink} onClick={() => go('signup')}>Create an account</button></p>
              </>
            )}
            {mode === 'signup' && (
              <p style={S.switch}>Already have an account? <button type="button" style={S.inlineLink} onClick={() => go('signin')}>Sign in</button></p>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button type="button" style={S.link} onClick={() => { clearUrl(); go('signin') }}>Back to sign in</button>
            )}
          </form>
        )}
      </div>
      <LegalLinks style={{ background: 'rgba(13,17,23,0.85)', padding: '6px 14px', borderRadius: 999 }} />
    </div>
  )
}

const TITLES  = { signin: 'Sign in', signup: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' }
const BUTTONS = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }

function describeLinkError(code, resetToken) {
  if (!code) return null
  if (resetToken !== null || window.location.pathname === '/reset-password') return 'That reset link has expired or was already used. Ask for a new one.'
  if (/token/i.test(code)) return 'That link has expired or was already used. Sign in and we will send a fresh one.'
  return 'Sign-in did not complete. Please try again.'
}

function Field({ label, value, onChange, hint, ...rest }) {
  return (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} style={S.input} {...rest} />
      {hint && <span style={S.hint}>{hint}</span>}
    </label>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  )
}

const S = {
  backdrop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    minHeight: '100dvh', padding: 16,
    // Light scrim: the cover artwork is already dark navy.
    backgroundImage: 'linear-gradient(rgba(13,17,23,0.45), rgba(13,17,23,0.65)), url(/book-cover.jpeg)',
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
  },
  card: {
    width: '100%', maxWidth: 380,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  },
  form:   { display: 'flex', flexDirection: 'column', gap: 12 },
  brand:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px', color: 'var(--text-1)', margin: '0 0 12px' },
  title:  { fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' },
  text:   { fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)', margin: '0 0 8px' },
  field:  { display: 'flex', flexDirection: 'column', gap: 6 },
  label:  { fontSize: 13, fontWeight: 500, color: 'var(--text-2)' },
  hint:   { fontSize: 12, color: 'var(--text-3)' },
  input: {
    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-raised)', color: 'var(--text-1)', fontSize: 16, // 16px stops iOS zooming in
  },
  error:  { fontSize: 13, color: 'var(--red)', margin: 0 },
  button: {
    marginTop: 4, padding: '11px 0', borderRadius: 8, border: 'none',
    background: 'var(--blue)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  google: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-hi)',
    background: 'var(--bg-raised)', color: 'var(--text-1)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
  },
  or:     { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-3)' },
  orLine: { flex: 1, height: 1, background: 'var(--border)' },
  link: {
    background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13,
    cursor: 'pointer', padding: 4, alignSelf: 'center',
  },
  switch:     { fontSize: 13, color: 'var(--text-2)', textAlign: 'center', margin: 0 },
  inlineLink: { background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', padding: 0 },
}
