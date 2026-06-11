import { useState, useEffect } from 'react'
import { getCVEs, saveCVE, deleteCVE } from '../lib/db.js'

const SEVERITIES = ['low', 'medium', 'high', 'critical']
const STATUSES   = ['managed', 'unmanaged', 'denial']

const SEV_COLOR = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--blue)' }
const STAT_LABEL = { managed: 'Managed', unmanaged: 'Unmanaged', denial: 'In Denial' }

const emptyForm = () => ({ title: '', description: '', severity: 'medium', status: 'unmanaged', notes: '' })

export default function CVERegister() {
  const [cves, setCves] = useState([])
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null)  // null = closed, {} = new, {id,...} = edit
  const [expanded, setExpanded] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () => getCVEs().then(setCves)
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? cves : cves.filter(c => c.status === filter)

  const openNew  = () => setForm(emptyForm())
  const openEdit = c  => setForm({ ...c })
  const closeForm= () => setForm(null)

  const submit = async () => {
    if (!form.title.trim()) return
    await saveCVE(form)
    closeForm(); load()
  }

  const remove = async id => {
    await deleteCVE(id); setConfirmDelete(null); load()
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>CVE Register</h1>
        <button className="btn btn-primary" style={{ padding: '8px 14px' }} onClick={openNew}>+ Add</button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...STATUSES].map(s => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : STAT_LABEL[s]}
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
              {s === 'all' ? cves.length : cves.filter(c => c.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* CVE list */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '48px 16px', fontSize: 14 }}>
          {filter === 'all' ? 'No vulnerabilities logged yet.' : `No ${STAT_LABEL[filter].toLowerCase()} entries.`}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(c => (
          <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-1)', fontSize: 15, flex: 1 }}>{c.title}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className={`badge badge-${c.severity}`}>{c.severity}</span>
                  <span className={`badge badge-${c.status}`}>{STAT_LABEL[c.status]}</span>
                </div>
              </div>
              {c.description && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {c.description}
                </p>
              )}
            </button>

            {expanded === c.id && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
                {c.description && <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6 }}>{c.description}</p>}
                {c.notes && (
                  <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notes</p>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{c.notes}</p>
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
                  Added {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: 13 }} onClick={() => setConfirmDelete(c.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Form drawer */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={closeForm}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{form.id ? 'Edit vulnerability' : 'New vulnerability'}</h2>

            <label>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="What is the vulnerability?" style={{ marginBottom: 14 }} />

            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              placeholder="How does it manifest? What triggers it?" rows={3} style={{ marginBottom: 14 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label>Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({...f, severity: e.target.value}))}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {STATUSES.map(s => <option key={s} value={s}>{STAT_LABEL[s]}</option>)}
                </select>
              </div>
            </div>

            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              placeholder="Patch progress, triggers, context..." rows={2} style={{ marginBottom: 20 }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={!form.title.trim()}>
                {form.id ? 'Save changes' : 'Add to register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Delete this entry?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
