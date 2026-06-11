import { useState, useEffect } from 'react'
import { getDomains, updateDomain } from '../lib/db.js'

const SEVERITY_COLOR = score =>
  score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--yellow)' : 'var(--red)'

const SEVERITY_DIM = score =>
  score >= 7 ? 'var(--green-dim)' : score >= 4 ? 'var(--yellow-dim)' : 'var(--red-dim)'

const POSTURE_LABEL = avg =>
  avg >= 8 ? 'SECURE' : avg >= 6 ? 'GUARDED' : avg >= 4 ? 'ELEVATED' : 'CRITICAL'

export default function Dashboard({ onNavigate }) {
  const [domains, setDomains] = useState([])
  const [editing, setEditing] = useState(null)
  const [editScore, setEditScore] = useState(5)
  const [editNotes, setEditNotes] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { getDomains().then(setDomains) }, [])

  const avg = domains.length ? Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length) : 5
  const postureColor = SEVERITY_COLOR(avg)

  const openEdit = d => { setEditing(d); setEditScore(d.score); setEditNotes(d.notes || '') }
  const closeEdit = () => setEditing(null)

  const save = async () => {
    const updated = await updateDomain(editing.id, editScore, editNotes)
    setDomains(prev => prev.map(d => d.id === updated.id ? updated : d))
    setSaved(true); setTimeout(() => setSaved(false), 1500)
    closeEdit()
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            LifeSOC
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', margin: '2px 0 0' }}>
            Security Posture
          </h1>
        </div>
        <div style={{
          background: SEVERITY_DIM(avg), border: `1px solid ${postureColor}`,
          borderRadius: 8, padding: '6px 12px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: postureColor, lineHeight: 1, fontFamily: 'var(--mono)' }}>{avg}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: postureColor, letterSpacing: '0.1em', marginTop: 2 }}>{POSTURE_LABEL(avg)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24, background: 'var(--bg-raised)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${avg * 10}%`, background: postureColor, borderRadius: 6, transition: 'all 0.5s ease' }} />
      </div>

      {/* Domain grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {domains.map(d => (
          <button key={d.id} onClick={() => openEdit(d)} style={{
            background: 'var(--bg-surface)', border: `1px solid ${d.score !== 5 ? SEVERITY_DIM(d.score) : 'var(--border)'}`,
            borderRadius: 12, padding: '14px 12px', textAlign: 'left', cursor: 'pointer',
            transition: 'border-color 0.2s'
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{d.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 4 }}>{d.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: SEVERITY_COLOR(d.score), fontFamily: 'var(--mono)' }}>
                {d.score}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/10</span>
            </div>
            <div style={{ marginTop: 8, background: 'var(--bg-raised)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.score * 10}%`, background: SEVERITY_COLOR(d.score), borderRadius: 3 }} />
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick actions</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: '→ Log a new indicator of compromise', tab: 'scan', icon: '🔍' },
          { label: '→ Open the AI Analyst', tab: 'analyst', icon: '🤖' },
          { label: '→ Add a vulnerability to CVE register', tab: 'cve', icon: '🛡️' },
          { label: '→ Start an incident response', tab: 'incidents', icon: '🚨' }
        ].map(a => (
          <button key={a.tab} onClick={() => onNavigate(a.tab)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
            color: 'var(--text-2)', fontSize: 14, textAlign: 'left', transition: 'border-color 0.15s'
          }}>
            <span>{a.icon}</span><span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Edit drawer */}
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end'
        }} onClick={closeEdit}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>{editing.icon}</span>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{editing.label}</h2>
            </div>

            <label>Score: <span style={{ color: SEVERITY_COLOR(editScore), fontWeight: 700 }}>{editScore}/10</span></label>
            <input type="range" min="0" max="10" value={editScore}
              onChange={e => setEditScore(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', padding: '8px 0', marginBottom: 16 }} />

            <label style={{ marginBottom: 6 }}>Notes</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
              placeholder="What's driving this score?" rows={3} style={{ marginBottom: 16 }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeEdit}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save}>
                {saved ? '✓ Saved' : 'Update score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
