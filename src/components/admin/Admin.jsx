import { useCallback, useEffect, useMemo, useState } from 'react'

// Admin console at /admin. The server decides who is an admin (ADMIN_EMAILS);
// this page just shows "not authorised" when /api/admin/me says no.

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status })
  return data
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'users', label: 'Users' },
  { id: 'reviewers', label: 'Reviewer codes' },
  { id: 'settings', label: 'Settings' },
]

export default function Admin() {
  const [me, setMe] = useState(undefined) // undefined loading, null denied
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'overview')
  const [toast, setToast] = useState(null)

  useEffect(() => { api('/me').then(setMe).catch(() => setMe(null)) }, [])
  useEffect(() => {
    const url = new URL(location.href); url.searchParams.set('tab', tab); history.replaceState(null, '', url)
  }, [tab])

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind }); setTimeout(() => setToast(null), 3500)
  }, [])

  if (me === undefined) return <div style={S.center}>Loading…</div>
  if (me === null) {
    return (
      <div style={S.center}>
        <div style={{ ...S.card, maxWidth: 360, textAlign: 'center' }}>
          <p style={S.h2}>Not authorised</p>
          <p style={S.muted}>This page is for LifeSOC administrators.</p>
          <a href="/" style={S.link}>Back to LifeSOC</a>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <a href="/" style={S.brand}><img src="/logo-mark.svg" width="26" height="26" alt="" /><span>Life<span style={{ color: 'var(--blue)' }}>SOC</span></span><span style={S.adminTag}>Admin</span></a>
          <a href="/" style={{ ...S.link, fontSize: 13 }}>Back to app</a>
        </div>
        <nav style={S.tabs} role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              style={{ ...S.tab, ...(tab === t.id ? S.tabOn : {}) }}>{t.label}</button>
          ))}
        </nav>
      </header>
      <main style={S.main}>
        {tab === 'overview' && <Overview />}
        {tab === 'inbox' && <Inbox notify={notify} />}
        {tab === 'users' && <Users me={me} notify={notify} />}
        {tab === 'reviewers' && <Reviewers notify={notify} />}
        {tab === 'settings' && <Settings notify={notify} />}
      </main>
      {toast && <div role="status" style={{ ...S.toast, ...(toast.kind === 'err' ? S.toastErr : {}) }}>{toast.text}</div>}
    </div>
  )
}

// ── Overview ────────────────────────────────────────────────────────────────
function Overview() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { api('/overview').then(setData).catch((e) => setErr(e.message)) }, [])
  if (err) return <p style={S.error}>{err}</p>
  if (!data) return <p style={S.muted}>Loading…</p>
  const t = data.totals
  const tiles = [
    ['New messages', t.messagesNew, 'waiting in the Inbox'],
    ['Readers', t.users, `${t.verified} with confirmed email`],
    ['Active book access', t.activeAccess, `${plural(t.reviewers, 'reviewer')} · ${t.expiredAccess} expired`],
    ['Expiring in 30 days', t.expiringSoon, 'active readers'],
    ['New sign-ups', t.signups7, `last 7 days · ${t.signups30} in 30`],
    ['Active readers', t.active7, 'signed in, last 7 days'],
    ['AI requests', t.chat7 + t.scan7, `last 7 days · ${t.chat7} Analyst, ${t.scan7} Scanner`],
    ['Book link visits', t.book7, 'lifesoc.app/book, last 7 days'],
  ]
  return (
    <>
      <div style={S.tiles}>
        {tiles.map(([label, value, sub]) => (
          <div key={label} style={S.tile}>
            <div style={S.tileLabel}>{label}</div>
            <div style={S.tileValue}>{value}</div>
            <div style={S.tileSub}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <p style={S.h3}>Last 30 days</p>
        <Bars label="Sign-ups" values={data.series.signups} days={data.series.days} color="var(--blue)" />
        <Bars label="Book redemptions" values={data.series.redemptions} days={data.series.days} color="var(--green)" />
        <Bars label="AI requests" values={data.series.chat.map((v, i) => v + data.series.scan[i])} days={data.series.days} color="var(--purple)" />
      </div>
      <div style={S.card}>
        <p style={S.h3}>Recent admin activity</p>
        {data.recent.length === 0 ? <p style={S.muted}>Nothing yet.</p> : <AuditList rows={data.recent} />}
      </div>
    </>
  )
}

function Bars({ label, values, days, color }) {
  const max = Math.max(1, ...values)
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 44 }} role="img" aria-label={`${label}: ${total} in 30 days`}>
        {values.map((v, i) => (
          <div key={days[i]} title={`${days[i]}: ${v}`}
            style={{ flex: 1, minWidth: 0, height: `${Math.max(v ? 8 : 3, (v / max) * 100)}%`, background: v ? color : 'var(--bg-raised)', borderRadius: 2 }} />
        ))}
      </div>
    </div>
  )
}

const ACTION_LABELS = {
  'access.grant': 'Granted access', 'access.extend': 'Extended access', 'access.revoke': 'Revoked access',
  'access.downloads': 'Changed downloads', 'email.verification': 'Resent confirmation', 'email.password_reset': 'Sent password reset',
  'sessions.revoke': 'Signed out everywhere', 'user.delete': 'Deleted account', 'message.reply': 'Replied to a reader', 'message.archived': 'Archived a message', 'message.new': 'Reopened a message', 'message.answered': 'Marked answered',
  'reviewer.add': 'Added reviewer code',
  'reviewer.revoke': 'Revoked reviewer code', 'reviewer.restore': 'Restored reviewer code', 'settings.update': 'Updated settings',
}

function AuditList({ rows }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((r, i) => (
        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
          <span style={{ minWidth: 0 }}><span style={{ color: 'var(--text-1)' }}>{ACTION_LABELS[r.action] ?? r.action}</span>{r.target && <span style={{ color: 'var(--text-3)' }}> · {r.target}</span>}</span>
          <span style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{ago(r.at)}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Inbox ───────────────────────────────────────────────────────────────────
const MSG_TYPE = { question: ['Question', 'var(--blue)', 'var(--blue-dim)'], feedback: ['Feedback', 'var(--green)', 'var(--green-dim)'], problem: ['Problem', 'var(--red)', 'var(--red-dim)'] }

function Inbox({ notify }) {
  const [status, setStatus] = useState('new')
  const [type, setType] = useState('')
  const [data, setData] = useState(null)
  const load = useCallback(() => {
    const q = new URLSearchParams(); if (status) q.set('status', status); if (type) q.set('type', type)
    return api(`/messages?${q}`).then(setData).catch((e) => notify(e.message, 'err'))
  }, [status, type, notify])
  useEffect(() => { load() }, [load])

  return (
    <>
      {data && (
        <div style={S.tiles}>
          <div style={S.tile}><div style={S.tileLabel}>New</div><div style={S.tileValue}>{data.counts.new}</div><div style={S.tileSub}>waiting for a reply</div></div>
          <div style={S.tile}><div style={S.tileLabel}>Answered</div><div style={S.tileValue}>{data.counts.answered}</div><div style={S.tileSub}>{data.counts.archived} archived</div></div>
          <div style={S.tile}><div style={S.tileLabel}>Book rating</div><div style={S.tileValue}>{data.ratings.average ?? '–'}{data.ratings.average ? <span style={{ fontSize: 16, color: 'var(--yellow)' }}> ★</span> : null}</div><div style={S.tileSub}>{plural(data.ratings.count, 'rating')}</div></div>
        </div>
      )}
      <div style={S.toolbar}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...S.input, width: 'auto' }} aria-label="Status">
          <option value="new">New</option><option value="answered">Answered</option><option value="archived">Archived</option><option value="">All</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...S.input, width: 'auto' }} aria-label="Type">
          <option value="">All types</option><option value="question">Questions</option><option value="feedback">Feedback</option><option value="problem">Problems</option>
        </select>
      </div>
      {!data ? <p style={S.muted}>Loading…</p> : data.messages.length === 0
        ? <div style={{ ...S.card, textAlign: 'center' }}><p style={S.muted}>{status === 'new' ? 'Nothing waiting. Inbox zero.' : 'No messages here.'}</p></div>
        : data.messages.map((m) => <InboxItem key={m.id} m={m} notify={notify} reload={load} />)}
    </>
  )
}

function InboxItem({ m, notify, reload }) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [label, fg, bg] = MSG_TYPE[m.type] ?? MSG_TYPE.question
  const send = async () => {
    setBusy(true)
    try {
      const r = await api(`/messages/${m.id}/reply`, { method: 'POST', body: { body: reply } })
      notify(r.emailed ? 'Reply sent by email and in the app' : "Reply saved in the app, but the email couldn't be sent", r.emailed ? 'ok' : 'err')
      setReply(''); reload()
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  const setStatus = async (status) => {
    try { await api(`/messages/${m.id}/status`, { method: 'POST', body: { status } }); notify(status === 'archived' ? 'Archived' : status === 'new' ? 'Moved back to New' : 'Marked answered'); reload() }
    catch (e) { notify(e.message, 'err') }
  }
  return (
    <div style={{ ...S.card, ...(m.status === 'new' ? { borderColor: 'var(--blue-dim)' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ ...S.pill, color: fg, background: bg }}>{label}</span>
        {m.rating ? <span style={{ color: 'var(--yellow)', fontSize: 14, letterSpacing: 1 }} aria-label={`${m.rating} of 5 stars`}>{'★'.repeat(m.rating)}<span style={{ color: 'var(--border-hi)' }}>{'★'.repeat(5 - m.rating)}</span></span> : null}
        {m.chapter && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>· {m.chapter}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{ago(m.updatedAt)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}><b style={{ color: 'var(--text-1)' }}>{m.user.name || m.user.email.split('@')[0]}</b> · {m.user.email}</div>
      <Msg body={m.body} />
      {m.replies.map((r) => <Msg key={r.id} body={r.body} who={r.author === 'admin' ? 'You' : m.user.name || 'Reader'} at={r.createdAt} mine={r.author === 'admin'} />)}
      {m.meta && <p style={{ ...S.muted, fontSize: 11, marginTop: 8, overflowWrap: 'anywhere' }}>Device: {m.meta.ua}{m.meta.screen ? ` · ${m.meta.screen}` : ''}{m.meta.standalone ? ' · installed app' : ''}</p>}
      <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${m.user.name || 'the reader'}… (they get it by email and in the app)`}
        style={{ ...S.input, width: '100%', marginTop: 10, resize: 'vertical' }} maxLength={8000} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button style={S.primary} disabled={busy || reply.trim().length < 2} onClick={send}>{busy ? 'Sending…' : 'Send reply'}</button>
        {m.status !== 'archived' && <Btn onClick={() => setStatus('archived')}>Archive</Btn>}
        {m.status !== 'new' && <Btn onClick={() => setStatus('new')}>Move to New</Btn>}
        {m.status === 'new' && <Btn onClick={() => setStatus('answered')}>Mark answered</Btn>}
      </div>
    </div>
  )
}

function Msg({ body, who, at, mine }) {
  return (
    <div style={{ padding: '9px 11px', borderRadius: 10, background: mine ? 'var(--blue-dim)' : 'var(--bg-raised)', marginTop: 6, marginLeft: mine ? 24 : 0 }}>
      {who && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{who} · {ago(at)}</div>}
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{body}</div>
    </div>
  )
}

// ── Users ───────────────────────────────────────────────────────────────────
function Users({ me, notify }) {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState(null)
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback((query) => api(`/users${query ? `?q=${encodeURIComponent(query)}` : ''}`).then((d) => setUsers(d.users)).catch((e) => notify(e.message, 'err')), [notify])
  useEffect(() => { const h = setTimeout(() => load(q.trim()), 250); return () => clearTimeout(h) }, [q, load])

  const shown = useMemo(() => (users ?? []).filter((u) => filter === 'all' || u.access.status === filter || (filter === 'unverified' && !u.emailVerified)), [users, filter])

  const act = async (u, label, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(u.id)
    try {
      const r = await fn()
      if (r?.user) setUsers((list) => list.map((x) => (x.id === u.id ? r.user : x)))
      notify(label)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  return (
    <>
      <div style={S.toolbar}>
        <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...S.input, flex: '1 1 220px' }} aria-label="Search users" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...S.input, flex: '0 0 auto', width: 'auto' }} aria-label="Filter">
          <option value="all">All readers</option><option value="active">Active access</option><option value="expired">Expired</option>
          <option value="none">No access</option><option value="unverified">Email not confirmed</option>
        </select>
      </div>
      {!users ? <p style={S.muted}>Loading…</p> : shown.length === 0 ? <p style={S.muted}>No readers match.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((u) => {
            const isOpen = open === u.id
            const hasPassword = u.providers.includes('credential')
            return (
              <div key={u.id} style={{ ...S.card, padding: 0, marginBottom: 0, opacity: busy === u.id ? 0.6 : 1 }}>
                <button onClick={() => setOpen(isOpen ? null : u.id)} style={S.userRow} aria-expanded={isOpen}>
                  <Avatar u={u} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={S.userName}>{u.name || u.email.split('@')[0]}{u.isAdmin && <span style={S.badge}>admin</span>}</span>
                    <span style={S.userEmail}>{u.email}</span>
                  </span>
                  <StatusPill access={u.access} />
                </button>
                {isOpen && (
                  <div style={S.userDetail}>
                    <dl style={S.dl}>
                      <Item k="Sign-in" v={u.providers.map((p) => (p === 'credential' ? 'Email + password' : p[0].toUpperCase() + p.slice(1))).join(', ') || '—'} />
                      <Item k="Email" v={u.emailVerified ? 'Confirmed' : 'Not confirmed'} />
                      <Item k="Joined" v={fmtDate(u.createdAt)} />
                      <Item k="Last active" v={u.lastSeen ? ago(u.lastSeen) : 'Never'} />
                      <Item k="Book access" v={accessText(u.access)} />
                      <Item k="Audiobook downloads" v={u.access.canDownload ? 'Allowed' : 'Off'} />
                      <Item k="AI requests (30 days)" v={u.ai30} />
                      <Item k="Signed-in devices" v={u.sessions} />
                    </dl>
                    <div style={S.actions}>
                      {u.access.status !== 'active' && <Btn onClick={() => act(u, 'Access granted for a year', () => api(`/users/${u.id}/access`, { method: 'POST', body: { action: 'grant' } }))}>Grant 1 year</Btn>}
                      {u.access.status !== 'none' && u.access.type !== 'reviewer' && <>
                        <Btn onClick={() => act(u, 'Extended by 30 days', () => api(`/users/${u.id}/access`, { method: 'POST', body: { action: 'extend', days: 30 } }))}>+30 days</Btn>
                        <Btn onClick={() => act(u, 'Extended by a year', () => api(`/users/${u.id}/access`, { method: 'POST', body: { action: 'extend', days: 365 } }))}>+1 year</Btn>
                      </>}
                      {u.access.status === 'active' && <Btn danger onClick={() => act(u, 'Access revoked', () => api(`/users/${u.id}/access`, { method: 'POST', body: { action: 'revoke' } }), `Revoke book access for ${u.email}?`)}>Revoke access</Btn>}
                      <Btn onClick={() => act(u, u.access.canDownload ? 'Downloads turned off' : 'Downloads allowed', () => api(`/users/${u.id}/access`, { method: 'POST', body: { action: 'downloads', value: !u.access.canDownload } }))}>{u.access.canDownload ? 'Turn off downloads' : 'Allow downloads'}</Btn>
                      {!u.emailVerified && hasPassword && <Btn onClick={() => act(u, 'Confirmation email sent', () => api(`/users/${u.id}/resend-verification`, { method: 'POST' }))}>Resend confirmation</Btn>}
                      {hasPassword && <Btn onClick={() => act(u, 'Password reset email sent', () => api(`/users/${u.id}/password-reset`, { method: 'POST' }))}>Send password reset</Btn>}
                      {u.sessions > 0 && <Btn onClick={() => act(u, 'Signed out on all devices', async () => { await api(`/users/${u.id}/sign-out`, { method: 'POST' }); return { user: { ...u, sessions: 0 } } }, `Sign ${u.email} out on every device?`)}>Sign out everywhere</Btn>}
                      {u.id !== me.id && !u.isAdmin && <Btn danger onClick={() => act(u, 'Account deleted', async () => { await api(`/users/${u.id}`, { method: 'DELETE' }); setUsers((l) => l.filter((x) => x.id !== u.id)) }, `Permanently delete ${u.email}? Their account and book access are removed. This can't be undone.`)}>Delete account</Btn>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Avatar({ u }) {
  const letter = (u.name || u.email || '?').trim()[0]?.toUpperCase()
  return u.image
    ? <img src={u.image} alt="" width="36" height="36" referrerPolicy="no-referrer" style={{ borderRadius: '50%', flexShrink: 0 }} />
    : <span style={S.avatar}>{letter}</span>
}

function StatusPill({ access }) {
  const map = {
    active: access.type === 'reviewer' ? ['Reviewer', 'var(--purple)', 'var(--purple-dim)'] : ['Active', 'var(--green)', 'var(--green-dim)'],
    expired: ['Expired', 'var(--yellow)', 'var(--yellow-dim)'],
    none: ['No access', 'var(--text-3)', 'var(--bg-raised)'],
  }
  const [text, fg, bg] = map[access.status] ?? map.none
  return <span style={{ ...S.pill, color: fg, background: bg }}>{text}</span>
}

const Item = ({ k, v }) => <div style={S.dlRow}><dt style={S.dt}>{k}</dt><dd style={S.dd}>{v}</dd></div>

function accessText(a) {
  if (a.status === 'none') return 'None'
  if (a.type === 'reviewer') return `Reviewer (${a.reviewer || 'code'}), no expiry`
  const when = a.expiresAt ? fmtDate(a.expiresAt) : '—'
  const via = a.type === 'granted' ? 'granted by admin' : a.redeemedAt ? `redeemed ${fmtDate(a.redeemedAt)}` : ''
  return `${a.status === 'expired' ? 'Expired' : 'Until'} ${when}${via ? ` · ${via}` : ''}${a.extended && a.type !== 'granted' ? ' · extended' : ''}`
}

// ── Reviewer codes ──────────────────────────────────────────────────────────
function Reviewers({ notify }) {
  const [list, setList] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [created, setCreated] = useState(null)
  const load = useCallback(() => api('/reviewers').then((d) => setList(d.reviewers)).catch((e) => notify(e.message, 'err')), [notify])
  useEffect(() => { load() }, [load])

  const add = async (e) => {
    e.preventDefault()
    try {
      const r = await api('/reviewers', { method: 'POST', body: { name, code: code || undefined } })
      setCreated(r); setName(''); setCode(''); load()
    } catch (err) { notify(err.message, 'err') }
  }
  const toggle = async (r) => {
    const revoke = !r.revoked_at
    if (revoke && !window.confirm(`Revoke ${r.name}'s code? Anyone who redeemed it loses access immediately.`)) return
    try { await api(`/reviewers/${encodeURIComponent(r.code)}/${revoke ? 'revoke' : 'restore'}`, { method: 'POST' }); notify(revoke ? 'Code revoked' : 'Code restored'); load() }
    catch (err) { notify(err.message, 'err') }
  }

  return (
    <>
      <form onSubmit={add} style={S.card}>
        <p style={S.h3}>New reviewer code</p>
        <p style={{ ...S.muted, marginTop: -4 }}>Reviewers skip the book question, can download the audiobook, and keep access until you revoke the code.</p>
        <div style={S.toolbar}>
          <input required placeholder="Reviewer name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...S.input, flex: '1 1 180px' }} aria-label="Reviewer name" />
          <input placeholder="Code (optional, generated if blank)" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...S.input, flex: '1 1 220px' }} aria-label="Code" />
          <button type="submit" style={S.primary}>Create code</button>
        </div>
        {created && (
          <div style={S.created}>
            Code for <b>{created.name}</b>: <code style={S.code}>{created.display}</code>
            <button type="button" style={S.smallBtn} onClick={() => navigator.clipboard?.writeText(created.display).then(() => notify('Copied'))}>Copy</button>
          </div>
        )}
      </form>
      {!list ? <p style={S.muted}>Loading…</p> : list.length === 0 ? <p style={S.muted}>No reviewer codes yet.</p> : (
        <div style={S.card}>
          {list.map((r, i) => (
            <div key={r.code} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ ...S.userName, flex: '1 1 auto' }}>{r.name}{r.revoked_at && <span style={{ ...S.badge, color: 'var(--red)', borderColor: 'var(--red)' }}>revoked</span>}</span>
                <code style={S.code}>{r.code.toUpperCase()}</code>
                <button style={r.revoked_at ? S.smallBtn : { ...S.smallBtn, color: 'var(--red)' }} onClick={() => toggle(r)}>{r.revoked_at ? 'Restore' : 'Revoke'}</button>
              </div>
              <div style={{ ...S.muted, fontSize: 12, marginTop: 4 }}>
                Created {fmtDate(r.created_at)} · {r.redemptions === 0 ? 'Not redeemed yet' : `Redeemed by ${r.redeemers.map((x) => x.email).join(', ')}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Settings ────────────────────────────────────────────────────────────────
function Settings({ notify }) {
  const [s, setS] = useState(null)
  const [envCode, setEnvCode] = useState(false)
  const [book, setBook] = useState({ link: '', visits: { d7: 0, total: 0 } })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api('/settings').then((d) => {
      setS({ ...d.settings, signups_paused: d.settings.signups_paused === '1' }); setEnvCode(d.envBookCodeSet)
      setBook({ link: d.bookLink, visits: d.bookVisits })
    }).catch((e) => notify(e.message, 'err'))
  }, [notify])
  if (!s) return <p style={S.muted}>Loading…</p>

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    try { const d = await api('/settings', { method: 'PUT', body: s }); setS({ ...d.settings, signups_paused: d.settings.signups_paused === '1' }); notify('Settings saved') }
    catch (err) { notify(err.message, 'err') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={save}>
      <div style={S.card}>
        <label style={S.switchRow}>
          <span><span style={S.h3}>Pause new sign-ups</span><span style={{ ...S.muted, display: 'block' }}>Nobody can create a new account (email or Google). Existing readers can still sign in.</span></span>
          <input type="checkbox" checked={s.signups_paused} onChange={(e) => setS({ ...s, signups_paused: e.target.checked })} style={{ width: 22, height: 22, flexShrink: 0 }} />
        </label>
      </div>
      <div style={S.card}>
        <label style={{ display: 'block' }}>
          <span style={S.h3}>Book purchase link</span>
          <span style={{ ...S.muted, display: 'block', marginBottom: 8 }}>
            Where <b style={{ color: 'var(--text-1)' }}>{book.link.replace(/^https:\/\//, '')}</b> sends people, for example your Amazon listing.
            Print the QR code below once: it always points at /book, so you can change the destination here at any time.
          </span>
          <input type="url" inputMode="url" value={s.book_url} onChange={(e) => setS({ ...s, book_url: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder="https://www.amazon.co.uk/dp/…" autoComplete="off" />
        </label>
        {!s.book_url && <p style={{ ...S.muted, marginTop: 8 }}>Not set yet: /book currently opens the LifeSOC home page.</p>}
        <div style={S.qrRow}>
          <img src="/api/admin/book-qr?format=png" alt={`QR code for ${book.link}`} width="132" height="132" style={S.qr} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/api/admin/book-qr?format=png" style={{ ...S.smallBtn, textDecoration: 'none' }}>Download PNG</a>
              <a href="/api/admin/book-qr?format=svg" style={{ ...S.smallBtn, textDecoration: 'none' }}>Download SVG (print)</a>
              <button type="button" style={S.smallBtn} onClick={() => navigator.clipboard?.writeText(book.link).then(() => notify('Link copied'))}>Copy link</button>
              <a href="/book" target="_blank" rel="noopener" style={{ ...S.smallBtn, textDecoration: 'none' }}>Test link ↗</a>
            </div>
            <span style={S.muted}>{book.visits.d7} visits in the last 7 days · {book.visits.total} in total</span>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <label style={{ display: 'block' }}>
          <span style={S.h3}>Announcement banner</span>
          <span style={{ ...S.muted, display: 'block', marginBottom: 8 }}>Shown at the top of the sign-in screen and the app. Leave empty to hide it.</span>
          <textarea rows={2} maxLength={300} value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} style={{ ...S.input, width: '100%', resize: 'vertical' }} placeholder="e.g. Scheduled maintenance tonight 10–11pm" />
        </label>
      </div>
      <div style={S.card}>
        <label style={{ display: 'block' }}>
          <span style={S.h3}>Book access code</span>
          <span style={{ ...S.muted, display: 'block', marginBottom: 8 }}>The code printed in the book. {envCode ? 'Leave empty to keep using the one in the server configuration.' : ''} Changing it doesn't affect readers who already redeemed.</span>
          <input value={s.book_access_code} onChange={(e) => setS({ ...s, book_access_code: e.target.value })} style={{ ...S.input, width: '100%' }} placeholder={envCode ? 'Using the server code' : 'Not set'} autoComplete="off" />
        </label>
      </div>
      <button type="submit" style={S.primary} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
    </form>
  )
}

// ── Bits ────────────────────────────────────────────────────────────────────
function Btn({ children, danger, ...rest }) {
  return <button type="button" style={{ ...S.smallBtn, ...(danger ? { color: 'var(--red)', borderColor: 'var(--red-dim)' } : {}) }} {...rest}>{children}</button>
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return fmtDate(iso)
}

const S = {
  page: { minHeight: '100dvh', background: 'var(--bg-base)', overflowY: 'auto' },
  center: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, color: 'var(--text-2)' },
  header: { position: 'sticky', top: 0, zIndex: 5, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' },
  headerInner: { maxWidth: 880, margin: '0 auto', padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-1)', fontWeight: 700, fontSize: 17, textDecoration: 'none' },
  adminTag: { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', marginLeft: 4 },
  tabs: { maxWidth: 880, margin: '0 auto', padding: '0 12px', display: 'flex', gap: 4, overflowX: 'auto' },
  tab: { background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-2)', padding: '10px 10px', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabOn: { color: 'var(--text-1)', borderBottomColor: 'var(--blue)' },
  main: { maxWidth: 880, margin: '0 auto', padding: '18px 16px 60px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 },
  tile: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 },
  tileLabel: { fontSize: 12, color: 'var(--text-3)', fontWeight: 500 },
  tileValue: { fontSize: 28, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2, margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' },
  tileSub: { fontSize: 12, color: 'var(--text-3)' },
  h2: { fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 6px' },
  h3: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 10px' },
  muted: { color: 'var(--text-3)', fontSize: 13, margin: '0 0 8px' },
  error: { color: 'var(--red)' },
  link: { color: 'var(--blue)', textDecoration: 'none' },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  input: { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-1)', fontSize: 15, minWidth: 0, fontFamily: 'inherit' },
  primary: { padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  smallBtn: { padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-1)', fontSize: 13, cursor: 'pointer' },
  userRow: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' },
  userName: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-1)', fontWeight: 600, fontSize: 14 },
  userEmail: { display: 'block', color: 'var(--text-3)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-dim)', color: 'var(--text-1)', display: 'grid', placeItems: 'center', fontWeight: 600, flexShrink: 0 },
  badge: { fontSize: 10, fontWeight: 600, color: 'var(--blue)', border: '1px solid var(--blue-dim)', borderRadius: 5, padding: '1px 5px' },
  pill: { fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 },
  userDetail: { borderTop: '1px solid var(--border)', padding: 14 },
  dl: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px 16px', margin: '0 0 14px' },
  dlRow: { minWidth: 0 },
  dt: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  dd: { margin: '2px 0 0', fontSize: 14, color: 'var(--text-1)' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  created: { marginTop: 4, padding: 12, borderRadius: 8, background: 'var(--green-dim)', color: 'var(--text-1)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  code: { fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--bg-raised)', padding: '3px 7px', borderRadius: 6, color: 'var(--text-1)' },
  qrRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  qr: { borderRadius: 8, background: '#fff', padding: 4, flexShrink: 0 },
  switchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer' },
  toast: { position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: 'var(--bg-raised)', border: '1px solid var(--border-hi)', color: 'var(--text-1)', padding: '10px 16px', borderRadius: 10, fontSize: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 20, maxWidth: 'calc(100vw - 32px)' },
  toastErr: { borderColor: 'var(--red)', color: 'var(--red)' },
}
