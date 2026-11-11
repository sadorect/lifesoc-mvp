import { useCallback, useEffect, useRef, useState } from 'react'
import { signIn, signUp, requestPasswordReset, resetPassword, getAuthConfig } from '../../lib/auth-client.js'
import Announcement from '../Announcement.jsx'
import './landing.css'

// Signed-out home: the "Radar console". Features sit on the radar as contacts
// (tap to reveal), sign-in lives behind "Enter the SOC", and the book behind
// "Open the dossier". Reset links (/reset-password?token=…) and link errors
// open the sign-in panel straight away.

const CONTACTS = [
  { a: 18,  r: .30, kind: 'Domain', c: '#3fb950', title: 'Relationships', body: 'Who has access to you, and what have they earned? Score trust like a network admin scores devices.' },
  { a: 72,  r: .44, kind: 'Tool',   c: '#58a6ff', title: 'Posture dashboard', body: 'Score all six domains from 0–10 and get one overall threat level: Secure, Guarded, Elevated or Critical.' },
  { a: 104, r: .24, kind: 'Domain', c: '#d29922', title: 'Finances', body: 'Your money is an attack surface. Track exposure, patch leaks, keep a reserve for incidents.' },
  { a: 140, r: .38, kind: 'Tool',   c: '#bc8cff', title: 'AI Analyst', body: 'Talk a situation through with an analyst grounded in the book. It asks the questions a SOC would.' },
  { a: 176, r: .28, kind: 'Domain', c: '#f85149', title: 'Health', body: 'Sleep, energy and stress are your uptime. Spot the slow drift before it becomes an outage.' },
  { a: 212, r: .43, kind: 'Tool',   c: '#58a6ff', title: 'IoC Scanner', body: 'Describe an offer, a person or a plan. Get the indicators of compromise spotted and scored.' },
  { a: 248, r: .26, kind: 'Domain', c: '#58a6ff', title: 'Career', body: 'Deliberate navigation or accumulated drift? Map the vulnerabilities in where you are heading.' },
  { a: 284, r: .40, kind: 'Tool',   c: '#d29922', title: 'Vulnerabilities & patches', body: 'A register of personal CVEs and the fixes you are applying, so nothing stays open for long.' },
  { a: 318, r: .32, kind: 'Domain', c: '#7ee3ff', title: 'Reputation', body: 'What can be said about you, and by whom? Reduce what an adversary could use.' },
  { a: 346, r: .45, kind: 'Tool',   c: '#f85149', title: 'Incident log', body: 'When something breaks: log it, contain it, recover, and write down the lesson.' },
  { a: 0,   r: .16, kind: 'Domain', c: '#bc8cff', title: 'Mental', body: 'The control room itself. Protect focus, beliefs and attention from intrusion.' },
]

const FEED = [
  ['ok', 'PATCHED', 'Emergency fund topped up'],
  ['warn', 'ALERT', 'Sleep below baseline · 4 nights'],
  ['info', 'SCAN', '"New business partner offer" · 2 IoCs'],
  ['crit', 'INCIDENT', 'Missed deadline · contained · lesson logged'],
  ['ok', 'POSTURE', 'Overall score up 6 → 7'],
  ['info', 'ANALYST', '"Am I over-trusting this friendship?" · reviewed'],
  ['warn', 'CVE', 'Overcommitting at work · patch scheduled'],
]

const REDACTED = ['verify before you trust', 'limit the blast radius', 'keep watching']

export default function Landing({ site = {} }) {
  const params = new URLSearchParams(window.location.search)
  const resetToken = window.location.pathname === '/reset-password' ? params.get('token') : null
  const linkError = params.get('error')

  const [panel, setPanel] = useState(resetToken || linkError ? 'auth' : null) // null | 'auth' | 'dossier'
  const [intel, setIntel] = useState(null) // { ct, x, y }
  const lastFocus = useRef(null)

  const open = useCallback((id) => { lastFocus.current = document.activeElement; setIntel(null); setPanel(id) }, [])
  const close = useCallback(() => { setPanel(null); lastFocus.current?.focus?.() }, [])

  // Keyboard: E enters, D opens the dossier, Esc closes whatever is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setIntel(null); if (panel) close(); return }
      if (e.target.matches?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'e' || e.key === 'E') open('auth')
      if (e.key === 'd' || e.key === 'D') open('dossier')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, open, close])

  useEffect(() => {
    const onDoc = () => setIntel(null)
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const showIntel = (e, ct) => {
    e.stopPropagation()
    if (intel?.ct === ct) return setIntel(null)
    const r = e.currentTarget.getBoundingClientRect(), w = Math.min(320, innerWidth - 32), h = 150
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8
    if (y + h > innerHeight - 60) y = r.top - h - 8
    setIntel({ ct, x: Math.max(16, Math.min(innerWidth - w - 16, x)), y: Math.max(16, y) })
  }

  return (
    <div className="lnd">
      <div className="lnd-stage">
        <div className="lnd-grid" />
        <div className="lnd-radar">
          <div className="lnd-rings" /><div className="lnd-cross" /><div className="lnd-sweep" />
          {CONTACTS.map((ct) => (
            <button key={ct.title} className="lnd-blip" onClick={(e) => showIntel(e, ct)}
              aria-label={`${ct.kind}: ${ct.title}`} aria-expanded={intel?.ct === ct}
              style={{ '--a': `${ct.a}deg`, '--a-num': ct.a, '--r': `calc(var(--radar) * ${(ct.r * 0.88).toFixed(3)})`, '--c': ct.c }}>
              <span className="lnd-dot" /><span className="lnd-tag">{ct.title}</span>
            </button>
          ))}
        </div>
        <div className="lnd-core" aria-hidden="true">
          <div className="lnd-halo" />
          <svg className="lnd-shield" viewBox="0 0 512 512">
            <defs><linearGradient id="lnd-sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6cb6ff" /><stop offset="1" stopColor="#1f6feb" /></linearGradient></defs>
            <path d="M256 64 L408 118 V240 C408 342 344 414 256 452 C168 414 104 342 104 240 V118 Z" fill="url(#lnd-sg)" />
            <path d="M256 64 L408 118 V240 C408 342 344 414 256 452 Z" fill="#000" opacity=".12" />
            <path d="M136 262 H198 L224 206 L260 322 L290 232 L308 262 H376" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
            <path className="lnd-beat" d="M136 262 H198 L224 206 L260 322 L290 232 L308 262 H376" fill="none" stroke="#fff" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="lnd-brand"><img src="/logo-mark.svg" width="26" height="26" alt="" /><span>Life<b>SOC</b></span></div>
      <Status />
      {site.announcement && <div className="lnd-announce"><Announcement text={site.announcement} floating /></div>}

      <div className="lnd-copy">
        <h1>Run your life like a <span>security operations centre.</span></h1>
        <p>Six domains. One posture score. Tap a blip on the radar to see what's watching.</p>
        <div className="lnd-triggers">
          <button className="lnd-trig primary" onClick={(e) => { e.stopPropagation(); open('auth') }}>Enter the SOC <span className="lnd-k">E</span></button>
          <button className="lnd-trig" onClick={(e) => { e.stopPropagation(); open('dossier') }}>Open the dossier <span className="lnd-k">D</span></button>
        </div>
        <div className="lnd-hint">// hover the radar · press E to enter · D for the book</div>
      </div>

      <div className="lnd-ticker" aria-label="Example SOC activity">
        <div className="lnd-track">{FEED.map(([cls, k, t]) => <span key={t}><b className={cls}>{k}</b>{t}</span>)}</div>
      </div>
      <div className="lnd-legal"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div>

      <div className={`lnd-intel${intel ? ' open' : ''}`} role="dialog" aria-modal="false" aria-label={intel?.ct.title}
        style={intel ? { left: intel.x, top: intel.y, '--c': intel.ct.c } : undefined} onClick={(e) => e.stopPropagation()}>
        {intel && <>
          <button className="lnd-x" aria-label="Close" onClick={() => setIntel(null)}>×</button>
          <div className="lnd-kind">{intel.ct.kind} · contact {String(CONTACTS.indexOf(intel.ct) + 1).padStart(2, '0')}</div>
          <h3>{intel.ct.title}</h3>
          <p>{intel.ct.body}</p>
        </>}
      </div>

      <div className={`lnd-scrim${panel ? ' open' : ''}`} onClick={close} />

      <aside className={`lnd-panel${panel === 'auth' ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Sign in" aria-hidden={panel !== 'auth'}>
        <div className="lnd-ph"><span className="lnd-code">ACCESS CONTROL // AUTH</span><button className="lnd-close" onClick={close} aria-label="Close">×</button></div>
        <div className="lnd-pb">
          {panel === 'auth' && <AuthForm site={site} resetToken={resetToken} linkError={linkError} onNeedBook={() => open('dossier')} />}
          <p className="lnd-legal-m"><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a></p>
        </div>
      </aside>

      <aside className={`lnd-panel left${panel === 'dossier' ? ' open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lnd-dossier-title" aria-hidden={panel !== 'dossier'}>
        <div className="lnd-ph"><span className="lnd-code">FILE 0x2A // SOURCE MATERIAL</span><button className="lnd-close" onClick={close} aria-label="Close">×</button></div>
        <Dossier onEnter={() => open('auth')} />
      </aside>
    </div>
  )
}

function Status() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="lnd-status" aria-hidden="true">
      <div className="lnd-live">System online</div>
      <div>6 domains under watch</div>
      <div>{now.toISOString().slice(11, 19)} UTC</div>
    </div>
  )
}

function Dossier({ onEnter }) {
  const [shown, setShown] = useState(() => REDACTED.map(() => false))
  const left = shown.filter((s) => !s).length
  const reveal = (i) => setShown((s) => s.map((v, j) => v || j === i))
  return (
    <div className="lnd-pb">
      <span className="lnd-stamp">DECLASSIFIED</span>
      <div className="lnd-dhead">
        <img src="/book-cover.jpeg" alt="Zero Trust: A Hacker's Blueprint for a Secure Life, book cover" />
        <div className="lnd-meta">
          <div>TITLE&nbsp;&nbsp;&nbsp;<b>Zero Trust</b></div>
          <div>AUTHOR&nbsp;&nbsp;<b>Tosin Omojola</b></div>
          <div>CLASS&nbsp;&nbsp;&nbsp;<b>Personal security</b></div>
          <div>STATUS&nbsp;&nbsp;<b className="ok">In circulation</b></div>
        </div>
      </div>
      <h2 className="lnd-booktitle" id="lnd-dossier-title">Zero Trust</h2>
      <p className="lnd-booksub">A Hacker's Blueprint for a Secure Life</p>
      <div className={`lnd-decl${left ? '' : ' done'}`}>
        <span>{left ? <><span className="lnd-bar" aria-hidden="true" />{left} line{left > 1 ? 's' : ''} redacted · tap to declassify</> : '✓ File fully declassified'}</span>
        {left > 0 && <button type="button" onClick={() => setShown(REDACTED.map(() => true))}>Declassify all</button>}
      </div>
      <p className="lnd-sub">
        Security teams stopped assuming anything inside the walls was safe. This book applies that thinking to everyday life:{' '}
        {REDACTED.map((text, i) => (
          <span key={text}>
            {shown[i]
              ? <span className="lnd-redact shown">{text}</span>
              : <span className="lnd-redact" role="button" tabIndex={0} aria-label="Redacted. Press to reveal" onClick={() => reveal(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(i) } }}>{text}</span>}
            {i === 0 ? ', ' : i === 1 ? ', and ' : '.'}
          </span>
        ))}
      </p>
      <ol className="lnd-steps">
        <li><b>Create an account</b>Google, or email and a password.</li>
        <li><b>Enter your book code</b>It's printed in your copy. Answer one quick question from the book.</li>
        <li><b>Unlock the SOC</b>Tools, AI Analyst, ebook and audiobook for 12 months.</li>
      </ol>
      <a className="lnd-buy" href="/book">Get the book ↗</a>
      <div className="lnd-row" style={{ justifyContent: 'center' }}><button className="lnd-link" onClick={onEnter}>Already have it? Enter the SOC</button></div>
    </div>
  )
}

// ── Sign in / sign up / forgot / reset ──────────────────────────────────────
function AuthForm({ site, resetToken, linkError, onNeedBook }) {
  const paused = !!site.signupsPaused
  const [mode, setMode] = useState(resetToken ? 'reset' : 'signin') // signin | signup | forgot | sent | reset | done
  const [sentWhat, setSentWhat] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(() => describeLinkError(linkError, resetToken))
  const [busy, setBusy] = useState(false)
  const [google, setGoogle] = useState(false)
  const firstField = useRef(null)

  useEffect(() => { getAuthConfig().then((c) => setGoogle(!!c.google)) }, [])
  useEffect(() => { const t = setTimeout(() => firstField.current?.focus(), 320); return () => clearTimeout(t) }, [mode])

  const go = (next) => { setMode(next); setError(null); setPassword('') }
  const clearUrl = () => window.history.replaceState(null, '', '/')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      if (mode === 'signin') {
        const { error } = await signIn.email({ email, password, callbackURL: '/' })
        if (error?.code === 'EMAIL_NOT_VERIFIED') { setSentWhat('We sent you a new link to confirm your email. Open it to finish signing in.'); setMode('sent') }
        else if (error) setError(error.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Wrong email or password.')
        else clearUrl()
      } else if (mode === 'signup') {
        const { error } = await signUp.email({ name: name.trim() || email.split('@')[0], email, password, callbackURL: '/' })
        if (error) {
          setError(error.status === 429 ? 'Too many attempts. Wait a few minutes and try again.'
            : /ALREADY_EXISTS/.test(error.code ?? '') ? 'There is already an account with that email. Sign in instead.'
            : error.message || 'Could not create the account.')
        } else { setSentWhat(`We sent a link to ${email}. Open it to confirm your email and sign in.`); setMode('sent') }
      } else if (mode === 'forgot') {
        const { error } = await requestPasswordReset({ email, redirectTo: '/reset-password' })
        if (error?.status === 429) setError('Too many requests. Wait a few minutes and try again.')
        else { setSentWhat(`If there is an account for ${email}, we've sent it a link to choose a new password.`); setMode('sent') }
      } else if (mode === 'reset') {
        const { error } = await resetPassword({ newPassword: password, token: resetToken })
        if (error) setError('That reset link has expired or was already used. Ask for a new one.')
        else { clearUrl(); setSentWhat('Your password has been changed. Sign in with the new one.'); setMode('done') }
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  if (mode === 'sent' || mode === 'done') {
    return (
      <div className="lnd-sent">
        <div className="lnd-icon" aria-hidden="true">{mode === 'sent' ? '✉' : '✓'}</div>
        <h2>{mode === 'sent' ? 'Check your email' : 'Password changed'}</h2>
        <p className="lnd-sub">{sentWhat}</p>
        <button className="lnd-link" onClick={() => go('signin')}>Back to sign in</button>
      </div>
    )
  }

  const tabbed = mode === 'signin' || mode === 'signup'
  const TITLES = { signin: ['Welcome back, analyst', 'Sign in to your SOC.'], signup: ['Recruit a new analyst', 'Create your account. You can add your book code next.'],
    forgot: ['Reset your password', "Enter your email and we'll send you a link to choose a new one."], reset: ['Choose a new password', 'At least 8 characters.'] }

  return (
    <form onSubmit={submit} noValidate={false}>
      {tabbed && !paused && (
        <div className="lnd-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => go('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => go('signup')}>Create account</button>
        </div>
      )}
      <h2>{TITLES[mode][0]}</h2>
      <p className="lnd-sub">{TITLES[mode][1]}</p>
      {paused && mode === 'signin' && <p className="lnd-note" style={{ marginTop: 0, marginBottom: 16 }}>New sign-ups are paused right now. Existing readers can sign in as usual.</p>}

      {google && tabbed && <>
        <button type="button" className="lnd-google" onClick={() => signIn.social({ provider: 'google', callbackURL: '/' })}><GoogleMark /> Continue with Google</button>
        <div className="lnd-or">or</div>
      </>}

      {error && <p className="lnd-error" role="alert">{error}</p>}

      {mode === 'signup' && <Field label="Name" value={name} onChange={setName} autoComplete="name" inputRef={firstField} />}
      {mode !== 'reset' && <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required placeholder="you@example.com" inputRef={mode === 'signup' ? undefined : firstField} />}
      {mode !== 'forgot' && (
        <Field label={mode === 'reset' ? 'New password' : 'Password'} type="password" value={password} onChange={setPassword} required minLength={8}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} hint={mode === 'signup' ? 'At least 8 characters.' : null}
          inputRef={mode === 'reset' ? firstField : undefined} />
      )}

      <button type="submit" className="lnd-submit" disabled={busy}>{busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }[mode]}</button>

      <div className="lnd-row">
        {mode === 'signin' && <button type="button" className="lnd-link" onClick={() => go('forgot')}>Forgot password?</button>}
        {(mode === 'forgot' || mode === 'reset') && <button type="button" className="lnd-link" onClick={() => { clearUrl(); go('signin') }}>Back to sign in</button>}
        <button type="button" className="lnd-link" onClick={onNeedBook}>Need the book?</button>
      </div>
      {tabbed && <div className="lnd-note"><b>Have the book?</b> After you sign in, enter the code from your copy to unlock 12 months of the tools, ebook and audiobook.</div>}
    </form>
  )
}

function Field({ label, value, onChange, hint, type = 'text', inputRef, ...rest }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const id = `lnd-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="lnd-field">
      <label className="lnd-label" htmlFor={id}>{label}</label>
      <input id={id} ref={inputRef} className="lnd-input" value={value} onChange={(e) => onChange(e.target.value)}
        type={isPassword && show ? 'text' : type} style={isPassword ? { paddingRight: 46 } : undefined} {...rest} />
      {isPassword && (
        <button type="button" className="lnd-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>}
        </button>
      )}
      {hint && <span className="lnd-fhint">{hint}</span>}
    </div>
  )
}

function describeLinkError(code, resetToken) {
  if (!code) return null
  if (resetToken !== null || window.location.pathname === '/reset-password') return 'That reset link has expired or was already used. Ask for a new one.'
  if (/token/i.test(code)) return 'That link has expired or was already used. Sign in and we will send a fresh one.'
  if (/paused|unable_to_create_user|signup/i.test(code)) return 'New sign-ups are paused right now, so a new account could not be created.'
  return 'Sign-in did not complete. Please try again.'
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
