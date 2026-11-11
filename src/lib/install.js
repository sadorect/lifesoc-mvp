// "Install app" support. Chrome/Edge/Android fire `beforeinstallprompt`, which we keep so a
// button can open the native install dialog later. iOS has no such event, so there we show
// "Share → Add to Home Screen" instructions instead. Imported first in main.jsx so the event
// is caught even if it fires before React mounts.
import { useEffect, useState } from 'react'

let deferred = null
let installed = false
const subs = new Set()
const emit = () => subs.forEach((f) => f())

const nav = typeof navigator !== 'undefined' ? navigator : {}
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true)
export const isIOS = /iphone|ipad|ipod/i.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit() })
}

/** mode: 'prompt' (native dialog available), 'ios' (show instructions), or null (hide the button). */
export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  const mode = installed || isStandalone() ? null : deferred ? 'prompt' : isIOS ? 'ios' : null
  async function prompt() {
    if (!deferred) return false
    const e = deferred
    deferred = null // a prompt event can only be used once
    let outcome = 'dismissed'
    try { await e.prompt(); ({ outcome } = await e.userChoice) } catch {}
    if (outcome === 'accepted') installed = true
    emit()
    return outcome === 'accepted'
  }
  return { mode, prompt }
}
