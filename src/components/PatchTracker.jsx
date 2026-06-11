import { useState, useEffect } from 'react'
import { getPatches, savePatch, addCheckIn, deletePatch, getCVEs } from '../lib/db.js'

const STATUSES = ['planned', 'in_progress', 'deployed', 'abandoned']
const S_LABEL  = { planned: 'Planned', in_progress: 'In Progress', deployed: 'Deployed', abandoned: 'Abandoned' }
const S_COLOR  = { planned: 'var(--blue)', in_progress: 'var(--yellow)', deployed: 'var(--green)', abandoned: 'var(--text-3)' }
const S_DIM    = { planned: 'var(--blue-dim)', in_progress: 'var(--yellow-dim)', deployed: 'var(--green-dim)', abandoned: 'var(--bg-raised)' }

const emptyForm = () => ({ title: '', description: '', status: 'planned', linkedCVEId: '', targetDate: '' })

export default function PatchTracker() {
  const [patches, setPatches] = useState([])
  const [cves, setCves] = useState([])
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState(null)
  const [checkInNote, setCheckInNote] = useState('')
  const [checkingIn, setCheckingIn] = useState(null)

  const load = async () => {
    const [p, c] = await Promise.all([getPatches(), getCVEs()])
    setPatches(p); setCves(c)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? patches : patches.filter(p => p.status === filter)

  const submit = async () => {
    if (!form.title.trim()) return
    await savePatch(form); setForm(null); load()
  }

  const changeStatus = async (patch, status) => {
    await savePatch({ ...patch, status }); load()
  }

  const submitCheckIn = async (patchId) => {
    if (!checkInNote.trim()) return
    await addCheckIn(patchId, checkInNote)
    setCheckInNote(''); setCheckingIn(null); load()
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Patch Tracker</h1>
        <button className="btn btn-primary" style={{ padding: '8px 14px' }} onClick={() => setForm(emptyForm())}>+ Add</button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {['all', ...STATUSES].map(s => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`}
            style={{ flexShrink: 0 }} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : S_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '48px 16px', fontSize: 14 }}>
          No patches yet. Every improvement starts here.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const linkedCVE = cves.find(c => c.id === p.linkedCVEId)
          return (
            <div key={p.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 14, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: 15 }}>{p.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: S_DIM[p.status], color: S_COLOR[p.status], flexShrink: 0 }}>
                    {S_LABEL[p.status]}
                  </span>
                </div>
                {linkedCVE && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🛡️</span> Linked: {linkedCVE.title}
                  </div>
                )}
                {p.targetDate && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Target: {new Date(p.targetDate).toLocaleDateString()}
                  </div>
                )}
              </button>

              {expanded === p.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
                  {p.description && <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>{p.description}</p>}

                  {/* Status selector */}
                  <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Update status</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => changeStatus(p, s)} style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                        background: p.status === s ? S_DIM[s] : 'var(--bg-raised)',
                        color: p.status === s ? S_COLOR[s] : 'var(--text-3)'
                      }}>{S_LABEL[s]}</button>
                    ))}
                  </div>

                  {/* Check-ins */}
                  {p.checkIns?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Check-ins</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.checkIns.slice(-3).map(ci => (
                          <div key={ci.id} style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{ci.note}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{new Date(ci.date).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {checkingIn === p.id ? (
                    <div>
                      <textarea value={checkInNote} onChange={e => setCheckInNote(e.target.value)}
                        placeholder="What happened? What did you deploy?" rows={2} style={{ marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => setCheckingIn(null)}>Cancel</button>
                        <button className="btn btn-primary" style={{ flex: 2, fontSize: 13 }} onClick={() => submitCheckIn(p.id)}>Log check-in</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => setForm({ ...p })}>Edit</button>
                      <button className="btn btn-ghost" style={{ flex: 2, fontSize: 13 }} onClick={() => setCheckingIn(p.id)}>+ Check-in</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Form drawer */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setForm(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{form.id ? 'Edit patch' : 'New patch'}</h2>

            <label>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="What are you committing to change?" style={{ marginBottom: 14 }} />

            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              placeholder="What does this patch involve?" rows={3} style={{ marginBottom: 14 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {STATUSES.map(s => <option key={s} value={s}>{S_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label>Target date</label>
                <input type="date" value={form.targetDate || ''}
                  onChange={e => setForm(f => ({...f, targetDate: e.target.value}))} />
              </div>
            </div>

            <label>Linked CVE (optional)</label>
            <select value={form.linkedCVEId || ''} onChange={e => setForm(f => ({...f, linkedCVEId: e.target.value}))}
              style={{ marginBottom: 20 }}>
              <option value="">None</option>
              {cves.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={!form.title.trim()}>
                {form.id ? 'Save changes' : 'Add patch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
