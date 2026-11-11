import { useEffect, useState } from 'react'

const KEY = 'lifesoc-dismissed-announcement'

/** Site-wide announcement set in the admin. Dismissing hides that exact text on this device. */
export function useSite() {
  const [site, setSite] = useState({ announcement: '', signupsPaused: false })
  useEffect(() => { fetch('/api/site').then((r) => (r.ok ? r.json() : null)).then((d) => d && setSite(d)).catch(() => {}) }, [])
  return site
}

export default function Announcement({ text, floating = false }) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  if (!text || dismissed === text) return null
  const close = () => { try { localStorage.setItem(KEY, text) } catch {} ; setDismissed(text) }
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.45,
      background: 'var(--blue-dim)', color: 'var(--text-1)', borderBottom: '1px solid rgba(56,139,253,0.4)',
      ...(floating ? { borderRadius: 10, border: '1px solid rgba(56,139,253,0.4)', width: '100%', maxWidth: 380 } : {}),
    }}>
      <span style={{ flex: 1 }}>{text}</span>
      <button onClick={close} aria-label="Dismiss announcement" style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}
