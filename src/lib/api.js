// The session cookie authenticates every call (same origin), so no tokens here.
export async function chatWithAnalyst(messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Chat failed')
  return data.content
}

export async function runIoCscan(input) {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Scan failed')
  return data
}

export async function getEntitlementStatus() {
  const res = await fetch('/api/entitlement')
  if (!res.ok) throw new Error('Failed to check entitlement')
  const data = await res.json()
  return data.status
}

export async function getRedeemChallenge() {
  const res = await fetch('/api/redeem-challenge')
  if (!res.ok) throw new Error('Failed to load verification question')
  return res.json()
}

export async function submitRedeem({ code, questionId, answer }) {
  const res = await fetch('/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, questionId, answer })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Redemption failed')
  return data
}
