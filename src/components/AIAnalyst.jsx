import { useState, useEffect, useRef } from 'react'
import { getMessages, saveMessage, clearMessages } from '../lib/db.js'
import { chatWithAnalyst } from '../lib/api.js'

const QUICK_PROMPTS = [
  'Analyse what I should focus on based on my current posture.',
  'I noticed an anomalous response in myself today. Help me trace it.',
  'Which of my open ports needs the most urgent attention?',
  'Help me design a red team exercise for a decision I\'m facing.',
  'What does my patch history suggest about where I\'m making progress?'
]

export default function AIAnalyst() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showClear, setShowClear] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { getMessages().then(setMessages) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput(''); setError(null)

    const userMsg = await saveMessage('user', content)
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const reply = await chatWithAnalyst(history)
      const assistantMsg = await saveMessage('assistant', reply)
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clear = async () => {
    await clearMessages(); setMessages([]); setShowClear(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>AI Analyst</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Zero Trust framework · Context-aware</p>
        </div>
        {messages.length > 0 && (
          <button className="chip" onClick={() => setShowClear(true)} style={{ fontSize: 12 }}>Clear</button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>LifeSOC AI Analyst</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                Trained on the Zero Trust framework. Applies the full book to your specific situation.
              </p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Quick starts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => send(p)} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px', fontSize: 13, color: 'var(--text-2)', cursor: 'pointer',
                  textAlign: 'left', lineHeight: 1.4
                }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.role === 'user' ? 'var(--blue)' : 'var(--bg-surface)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              fontSize: 14, lineHeight: 1.6, color: m.role === 'user' ? '#fff' : 'var(--text-1)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px',
              padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)' }}>
            {error}. Ensure ANTHROPIC_API_KEY is set in your Vercel environment.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)',
        borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask the analyst anything..." rows={1}
            style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 120, overflowY: 'auto', paddingTop: 11 }} />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--blue)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !input.trim() || loading ? 0.4 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Clear confirm */}
      {showClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 300, width: '100%' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Clear conversation?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>This permanently deletes the conversation history.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowClear(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={clear}>Clear</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8) }
          40% { opacity: 1; transform: scale(1) }
        }
      `}</style>
    </div>
  )
}
