import { useState, useEffect } from 'react'
import { getIncidents, saveIncident, updatePhase, deleteIncident } from '../lib/db.js'

const PHASES = [
  { id: 'identification', label: 'Identification', q: 'What has actually happened — the honest account?' },
  { id: 'containment',    label: 'Containment',    q: 'What are you doing to stop the breach spreading?' },
  { id: 'eradication',    label: 'Eradication',    q: 'What must be removed, ended, or fundamentally changed?' },
  { id: 'recovery',       label: 'Recovery',        q: 'What is being rebuilt, and in what sequence?' },
  { id: 'pir',            label: 'Post-IR Review',  q: 'What did you learn? What changes as a result?' }
]

const DOMAINS = ['relationships', 'finances', 'career', 'health', 'reputation', 'mental']

export default function IncidentLog() {
  const [incidents, setIncidents] = useState([])
  const [form, setForm] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [activePhase, setActivePhase] = useState('identification')
  const [phaseNote, setPhaseNote] = useState('')
  const [filter, setFilter] = useState('active')

  const load = () => getIncidents().then(setIncidents)
  useEffect(() => { load() }, [])

  const filtered = incidents.filter(i => filter === 'all' || i.status === filter)
  const openIncident = incidents.find(i => i.id === openId)

  const openDetail = (i) => {
    setOpenId(i.id)
    const firstIncomplete = PHASES.find(p => !i.phases[p.id]?.completedAt)
    setActivePhase(firstIncomplete?.id ?? 'identification')
    setPhaseNote(i.phases[firstIncomplete?.id ?? 'identification']?.notes ?? '')
  }

  const savePhase = async (completed = false) => {
    const updated = await updatePhase(openId, activePhase, phaseNote, completed)
    setIncidents(prev => prev.map(i => i.id === openId ? updated : i))
    if (completed) {
      const next = PHASES[PHASES.findIndex(p => p.id === activePhase) + 1]
      if (next) { setActivePhase(next.id); setPhaseNote(updated.phases[next.id]?.notes ?? '') }
    }
  }

  const switchPhase = (phaseId) => {
    const i = incidents.find(x => x.id === openId)
    setActivePhase(phaseId)
    setPhaseNote(i?.phases[phaseId]?.notes ?? '')
  }

  const submit = async () => {
    if (!form.title?.trim()) return
    await saveIncident(form); setForm(null); load()
  }

  const resolve = async (id) => {
    await saveIncident({ ...(incidents.find(i => i.id === id)), status: 'resolved' }); load()
  }

  const remove = async (id) => {
    await deleteIncident(id); if (openId === id) setOpenId(null); load()
  }

  const phaseCount = (inc) => PHASES.filter(p => inc.phases?.[p.id]?.completedAt).length

  if (openIncident) {
    const phase = PHASES.find(p => p.id === activePhase)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => setOpenId(null)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8 }}>
            ← Back
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{openIncident.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: 'var(--bg-raised)', borderRadius: 4, height: 4 }}>
              <div style={{ height: '100%', width: `${(phaseCount(openIncident) / 5) * 100}%`, background: 'var(--green)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{phaseCount(openIncident)}/5</span>
          </div>
        </div>

        {/* Phase tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', padding: '12px 16px', gap: 8, borderBottom: '1px solid var(--border)' }}>
          {PHASES.map(p => {
            const done = openIncident.phases?.[p.id]?.completedAt
            const isActive = activePhase === p.id
            return (
              <button key={p.id} onClick={() => switchPhase(p.id)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                background: isActive ? 'var(--blue-dim)' : done ? 'var(--green-dim)' : 'var(--bg-raised)',
                borderColor: isActive ? 'var(--blue)' : done ? 'var(--green)' : 'var(--border)',
                color: isActive ? 'var(--blue)' : done ? 'var(--green)' : 'var(--text-2)'
              }}>
                {done ? '✓ ' : ''}{p.label}
              </button>
            )
          })}
        </div>

        {/* Phase content */}
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>{phase.q}</p>
          <textarea value={phaseNote} onChange={e => setPhaseNote(e.target.value)}
            placeholder="Write honestly. This is not for anyone else." rows={6}
            style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => savePhase(false)}>Save notes</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => savePhase(true)}
              disabled={!phaseNote.trim()}>
              Mark complete →
            </button>
          </div>

          {/* Actions */}
          {openIncident.status === 'active' && phaseCount(openIncident) === 5 && (
            <button className="btn btn-ghost btn-full" style={{ marginTop: 12, color: 'var(--green)' }}
              onClick={() => resolve(openIncident.id)}>
              ✓ Mark incident resolved
            </button>
          )}
          <button className="btn btn-danger btn-full" style={{ marginTop: 8 }} onClick={() => remove(openIncident.id)}>
            Delete incident
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Incident Log</h1>
        <button className="btn btn-primary" style={{ padding: '8px 14px', background: 'var(--red)', color: '#fff' }}
          onClick={() => setForm({ title: '', summary: '', domain: 'mental', status: 'active' })}>
          + New
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['active', 'resolved', 'all'].map(s => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
              {s === 'all' ? incidents.length : incidents.filter(i => i.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '48px 16px', fontSize: 14 }}>
          {filter === 'active' ? 'No active incidents. The monitoring is working.' : 'Nothing here yet.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(inc => (
          <button key={inc.id} onClick={() => openDetail(inc)} style={{
            background: 'var(--bg-surface)', border: `1px solid ${inc.status === 'active' ? 'var(--red-dim)' : 'var(--border)'}`,
            borderRadius: 12, padding: 14, cursor: 'pointer', textAlign: 'left', width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 15 }}>{inc.title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
                background: inc.status === 'active' ? 'var(--red-dim)' : 'var(--green-dim)',
                color: inc.status === 'active' ? 'var(--red)' : 'var(--green)', flexShrink: 0 }}>
                {inc.status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, background: 'var(--bg-raised)', borderRadius: 3, height: 4 }}>
                <div style={{ height: '100%', width: `${(phaseCount(inc) / 5) * 100}%`,
                  background: inc.status === 'resolved' ? 'var(--green)' : 'var(--blue)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{phaseCount(inc)}/5 phases</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
              {new Date(inc.createdAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>

      {/* New incident form */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setForm(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)', width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Open incident response</h2>
            <label>Incident name</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="Name it concisely and honestly" style={{ marginBottom: 14 }} />
            <label>Primary domain affected</label>
            <select value={form.domain} onChange={e => setForm(f => ({...f, domain: e.target.value}))} style={{ marginBottom: 20 }}>
              {DOMAINS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, background: 'var(--red)' }} onClick={submit}
                disabled={!form.title?.trim()}>Open incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
