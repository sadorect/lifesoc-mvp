import { useState, useEffect } from 'react'
import { getScans, saveScan } from '../lib/db.js'
import { runIoCscan } from '../lib/api.js'

const RISK_COLOR = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--green)' }
const RISK_DIM   = { critical: 'var(--red-dim)', high: 'var(--orange-dim)', medium: 'var(--yellow-dim)', low: 'var(--green-dim)' }
const DOMAIN_ICONS = { relationships: '🤝', finances: '💰', career: '🧭', health: '❤️', reputation: '🔑', mental: '🧠' }

export default function IoCScanner() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { getScans().then(s => setHistory(s.slice(0, 10))) }, [])

  const scan = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await runIoCscan(input)
      const saved = await saveScan(input, r)
      setResult(saved)
      setHistory(prev => [saved, ...prev.slice(0, 9)])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>IoC Scanner</h1>
        {history.length > 0 && (
          <button className="chip" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'New scan' : `History (${history.length})`}
          </button>
        )}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.5 }}>
        Describe what you've been noticing — in your body, relationships, energy, or behaviour. The scanner will identify indicators of compromise.
      </p>

      {!showHistory && (
        <>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder="e.g. I've been waking up at 3am for three weeks. I'm avoiding a conversation I know I need to have. Work feels like performance rather than purpose..."
            rows={5} style={{ marginBottom: 12 }} />

          <button className="btn btn-primary btn-full" onClick={scan} disabled={loading || !input.trim()}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Scanning...
              </span>
            ) : '🔍 Run IoC Scan'}
          </button>

          {error && (
            <div style={{ marginTop: 12, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: 'var(--red)' }}>
              {error}. Make sure ANTHROPIC_API_KEY is configured.
            </div>
          )}

          {result && <ScanResult result={result} />}
        </>
      )}

      {showHistory && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map(h => (
            <div key={h.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(h.createdAt).toLocaleDateString()}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  background: RISK_DIM[h.riskLevel], color: RISK_COLOR[h.riskLevel], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h.riskLevel} risk
                </span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {h.input}
                </p>
                {h.findings?.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    {h.findings.length} indicator{h.findings.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ScanResult({ result }) {
  const color = RISK_COLOR[result.riskLevel]
  const dim   = RISK_DIM[result.riskLevel]

  return (
    <div style={{ marginTop: 20 }}>
      {/* Risk level header */}
      <div style={{ background: dim, border: `1px solid ${color}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>
            {result.riskLevel} risk
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{result.findings?.length ?? 0} indicators</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>{result.summary}</p>
      </div>

      {/* Findings */}
      {result.findings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.findings.map((f, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 15, flex: 1 }}>{f.ioc}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>{DOMAIN_ICONS[f.domain] || '📌'}</span>
                  <span className={`badge badge-${f.severity}`}>{f.severity}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 10 }}>{f.description}</p>
              <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '8px 12px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Recommendation
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{f.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.findings?.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--green)', padding: '24px', fontSize: 14 }}>
          ✓ No significant indicators detected. System looks stable.
        </div>
      )}
    </div>
  )
}
