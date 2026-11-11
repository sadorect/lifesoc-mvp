import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// "Talk to the author": readers send feedback, questions or problem reports and
// see replies. Opens as a sheet from the Book tab, the dashboard, the redeem
// screen, or a reply email link (/?messages=1).

const TYPES = [
  { id: 'question', label: 'Ask a question', hint: 'Something in the book you want Tosin to explain or expand on.' },
  { id: 'feedback', label: 'Give feedback', hint: 'What worked, what didn’t, what you’d like to see next.' },
  { id: 'problem', label: 'Report a problem', hint: 'Something in the app isn’t working. We attach your device type to help fix it.' },
]
const TYPE_LABEL = { question: 'Question', feedback: 'Feedback', problem: 'Problem report' }

async function call(path = '', opts = {}) {
  const res = await fetch(`/api/messages${path}`, {
    method: opts.method ?? 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

/** Unread replies count, for badges. */
export function useUnreadReplies() {
  const [n, setN] = useState(0)
  const refresh = useCallback(() => call().then((d) => setN(d.unread)).catch(() => {}), [])
  useEffect(() => { refresh() }, [refresh])
  return [n, refresh]
}

/** Opens itself when the page was reached from a reply email. */
export function useMessagesFromUrl(setOpen) {
  useEffect(() => {
    const url = new URL(location.href)
    if (url.searchParams.has('messages')) {
      setOpen(true); url.searchParams.delete('messages'); history.replaceState(null, '', url)
    }
  }, [setOpen])
}

export default function MessagesSheet({ open, onClose, initialTab }) {
  const [tab, setTab] = useState(initialTab ?? 'new')
  const [data, setData] = useState(null)
  const load = useCallback(() => call().then(setData).catch(() => setData({ messages: [], unread: 0, remainingToday: 0 })), [])

  useEffect(() => { if (open) { load() } }, [open, load])
  useEffect(() => { if (open && data?.unread && tab === 'mine') call('/seen', { method: 'POST' }).then(load) }, [open, tab, data?.unread, load])
  useEffect(() => { if (open && initialTab) setTab(initialTab) }, [open, initialTab])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div style={S.scrim} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="msg-title" style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <p id="msg-title" style={S.title}>Talk to the author</p>
            <p style={S.muted}>Questions and feedback go straight to Tosin Omojola.</p>
          </div>
          <button onClick={onClose} style={S.close} aria-label="Close">×</button>
        </div>
        <div style={S.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'new'} onClick={() => setTab('new')} style={{ ...S.tab, ...(tab === 'new' ? S.tabOn : {}) }}>New message</button>
          <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')} style={{ ...S.tab, ...(tab === 'mine' ? S.tabOn : {}) }}>
            My messages{data?.unread ? <span style={S.dot} aria-label={`${data.unread} new replies`}>{data.unread}</span> : null}
          </button>
        </div>
        <div style={S.body}>
          {tab === 'new'
            ? <Compose remaining={data?.remainingToday} onSent={() => { load(); setTab('mine') }} />
            : <Mine data={data} reload={load} />}
        </div>
      </div>
    </div>
  )
}

function Compose({ remaining, onSent }) {
  const [type, setType] = useState('question')
  const [rating, setRating] = useState(0)
  const [chapter, setChapter] = useState('')
  const [chapters, setChapters] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  useEffect(() => { call('/chapters').then((d) => setChapters(d.chapters)).catch(() => {}) }, [])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      await call('', { method: 'POST', body: {
        type, body, chapter: type === 'problem' ? '' : chapter, rating: type === 'feedback' ? rating || null : null,
        meta: type === 'problem' ? { screen: `${screen.width}x${screen.height}`, standalone: matchMedia('(display-mode: standalone)').matches } : undefined,
      } })
      setSent(true); setBody(''); setRating(0); setChapter('')
      setTimeout(() => { setSent(false); onSent() }, 1600)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (sent) return <div style={S.done}><div style={S.doneIcon}>✓</div><p style={S.title}>Sent</p><p style={S.muted}>You'll get an email when Tosin replies, and it'll appear under My messages.</p></div>

  const current = TYPES.find((t) => t.id === type)
  return (
    <form onSubmit={submit}>
      <div style={S.types} role="radiogroup" aria-label="What's this about?">
        {TYPES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)} style={{ ...S.typeBtn, ...(type === t.id ? S.typeOn : {}) }}>{t.label}</button>
        ))}
      </div>
      <p style={{ ...S.muted, margin: '0 0 14px' }}>{current.hint}</p>

      {type === 'feedback' && (
        <div style={{ marginBottom: 14 }}>
          <span style={S.label}>Your rating (optional)</span>
          <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(rating === n ? 0 : n)} style={{ ...S.star, color: n <= rating ? 'var(--yellow)' : 'var(--border-hi)' }}>★</button>
            ))}
          </div>
        </div>
      )}

      {type !== 'problem' && (
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={S.label}>Chapter or section (optional)</span>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">The book in general</option>
            {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: 'block' }}>
        <span style={S.label}>{type === 'problem' ? 'What went wrong?' : type === 'question' ? 'Your question' : 'Your feedback'}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={4000} required minLength={5}
          style={{ resize: 'vertical' }} placeholder={type === 'problem' ? 'What were you doing, and what happened?' : ''} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 14px' }}>
        <span>{remaining != null && remaining < 5 ? `${remaining} message${remaining === 1 ? '' : 's'} left today` : 'Private: only Tosin sees this.'}</span>
        <span>{body.length}/4000</span>
      </div>
      {error && <p style={S.error} role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full" disabled={busy || body.trim().length < 5 || remaining === 0}>{busy ? 'Sending…' : 'Send'}</button>
    </form>
  )
}

function Mine({ data, reload }) {
  if (!data) return <p style={S.muted}>Loading…</p>
  if (!data.messages.length) return <p style={{ ...S.muted, textAlign: 'center', padding: '24px 0' }}>No messages yet.</p>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{data.messages.map((m) => <Thread key={m.id} m={m} reload={reload} />)}</div>
}

function Thread({ m, reload }) {
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const send = async () => {
    setBusy(true); setError(null)
    try { await call(`/${m.id}/reply`, { method: 'POST', body: { body: reply } }); setReply(''); setOpen(false); reload() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const answered = m.replies.length > 0 && m.replies[m.replies.length - 1].author === 'admin' // Tosin had the last word
  return (
    <div style={{ ...S.thread, ...(m.unread ? { borderColor: 'var(--blue)' } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, fontSize: 12 }}>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>
          {TYPE_LABEL[m.type]}{m.rating ? ` · ${'★'.repeat(m.rating)}` : ''}{m.chapter ? ` · ${m.chapter}` : ''}
        </span>
        <span style={{ color: m.unread ? 'var(--blue)' : answered ? 'var(--green)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>{m.unread ? 'New reply' : answered ? 'Answered' : 'Waiting'}</span>
      </div>
      <Bubble who="You" at={m.createdAt} body={m.body} />
      {m.replies.map((r) => <Bubble key={r.id} who={r.author === 'admin' ? 'Tosin Omojola' : 'You'} at={r.createdAt} body={r.body} author={r.author === 'admin'} />)}
      {open ? (
        <div style={{ marginTop: 10 }}>
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} placeholder="Write a reply" style={{ resize: 'vertical' }} />
          {error && <p style={S.error}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={send} disabled={busy || reply.trim().length < 2}>{busy ? 'Sending…' : 'Send reply'}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={S.linkBtn}>Reply</button>
      )}
    </div>
  )
}

function Bubble({ who, at, body, author }) {
  return (
    <div style={{ ...S.bubble, ...(author ? S.bubbleAuthor : {}) }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{who} · {new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{body}</div>
    </div>
  )
}

/** Small entry-point button used on the Book tab, dashboard and redeem screen. */
export function TalkButton({ onClick, unread, style }) {
  return (
    <button onClick={onClick} className="btn btn-ghost" style={{ position: 'relative', ...style }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      Talk to the author
      {unread > 0 && <span style={{ ...S.dot, position: 'absolute', top: -6, right: -6 }} aria-label={`${unread} new replies`}>{unread}</span>}
    </button>
  )
}

const S = {
  scrim: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(2,4,8,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '18px 18px 10px' },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-1)' },
  muted: { margin: '2px 0 0', fontSize: 13, color: 'var(--text-3)' },
  close: { width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-2)', fontSize: 18, cursor: 'pointer', flexShrink: 0 },
  tabs: { display: 'flex', gap: 4, padding: '0 18px', borderBottom: '1px solid var(--border)' },
  tab: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-2)', padding: '10px 6px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  tabOn: { color: 'var(--text-1)', borderBottomColor: 'var(--blue)' },
  body: { padding: 18, paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' },
  types: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  typeBtn: { padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  typeOn: { background: 'var(--blue-dim)', borderColor: 'var(--blue)', color: 'var(--text-1)' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 },
  star: { fontSize: 28, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' },
  error: { color: 'var(--red)', fontSize: 13, margin: '0 0 10px' },
  done: { textAlign: 'center', padding: '28px 0' },
  doneIcon: { width: 52, height: 52, margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--green-dim)', color: 'var(--green)', fontSize: 24 },
  thread: { border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-base)' },
  bubble: { padding: '8px 10px', borderRadius: 10, background: 'var(--bg-raised)', marginTop: 6 },
  bubbleAuthor: { background: 'var(--blue-dim)', marginLeft: 16 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, padding: '8px 0 0', cursor: 'pointer' },
  dot: { display: 'inline-grid', placeItems: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--blue)', color: '#fff', fontSize: 11, fontWeight: 700 },
}

// One sheet for the whole signed-in app; any screen can open it.
const Ctx = createContext({ open: () => {}, unread: 0 })
export const useMessages = () => useContext(Ctx)

export function MessagesProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('new')
  const [unread, refresh] = useUnreadReplies()
  const openFromUrl = useCallback((v) => { setTab('mine'); setOpen(v) }, [])
  useMessagesFromUrl(openFromUrl)
  const value = { open: () => { setTab(unread ? 'mine' : 'new'); setOpen(true) }, unread }
  return (
    <Ctx.Provider value={value}>
      {children}
      <MessagesSheet open={open} initialTab={tab} onClose={() => { setOpen(false); refresh() }} />
    </Ctx.Provider>
  )
}
