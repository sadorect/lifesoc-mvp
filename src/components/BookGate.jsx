import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { getEntitlementStatus, getRedeemChallenge, submitRedeem } from '../lib/api.js'

export default function BookGate({ children }) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState(null) // null (loading) | 'none' | 'expired' | 'active'

  const refresh = useCallback(async () => {
    const token = await getToken()
    const s = await getEntitlementStatus(token)
    setStatus(s)
  }, [getToken])

  useEffect(() => { refresh().catch(() => setStatus('none')) }, [refresh])

  if (status === null) return <div style={S.center}>Loading…</div>
  if (status === 'active') return children
  if (status === 'expired') return <ExpiredScreen />
  return <RedeemScreen onRedeemed={refresh} />
}

function ExpiredScreen() {
  return (
    <div style={S.center}>
      <div style={S.card}>
        <p style={S.title}>Your complimentary year has ended.</p>
        <p style={S.subtitle}>Subscription options are coming soon.</p>
      </div>
    </div>
  )
}

function RedeemScreen({ onRedeemed }) {
  const { getToken } = useAuth()
  const [question, setQuestion] = useState(null)
  const [code, setCode]         = useState('')
  const [answer, setAnswer]     = useState('')
  const [error, setError]       = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getToken()
      .then(getRedeemChallenge)
      .then(setQuestion)
      .catch(() => setError('Could not load the verification question. Please refresh and try again.'))
  }, [getToken])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!question) return
    setSubmitting(true)
    setError(null)
    try {
      const token = await getToken()
      await submitRedeem(token, { code, questionId: question.questionId, answer })
      await onRedeemed()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={S.center}>
      <form onSubmit={handleSubmit} style={S.card}>
        <p style={S.title}>Redeem your book</p>
        <p style={S.subtitle}>Enter the access code from your book and answer the verification question below.</p>

        <label style={S.label}>Access code</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          style={S.input}
          autoComplete="off"
          required
        />

        <label style={S.label}>{question ? question.questionText : 'Loading question…'}</label>
        {question?.ref && <p style={S.hint}>{question.ref}</p>}
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          style={S.input}
          autoComplete="off"
          disabled={!question}
          required
        />

        {error && <p style={S.error}>{error}</p>}

        <button type="submit" style={S.button} disabled={submitting || !question}>
          {submitting ? 'Verifying…' : 'Redeem'}
        </button>
      </form>
    </div>
  )
}

const S = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100dvh', background: 'var(--bg-base)', padding: 24,
  },
  card: {
    display: 'flex', flexDirection: 'column', gap: 10,
    width: '100%', maxWidth: 360,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 24,
  },
  title:    { fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-3)', margin: '0 0 8px' },
  label:    { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginTop: 8 },
  hint:     { fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0', fontStyle: 'italic' },
  input: {
    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-raised)', color: 'var(--text-1)', fontSize: 14,
  },
  error:  { fontSize: 13, color: 'var(--red)', margin: '4px 0 0' },
  button: {
    marginTop: 12, padding: '10px 0', borderRadius: 8, border: 'none',
    background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
}
