import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInstall } from '../lib/install.js'

/** Renders nothing when the app is already installed or this browser can't install it. */
export default function InstallButton({ className, style, label = 'Install app' }) {
  const { mode, prompt } = useInstall()
  const [help, setHelp] = useState(false)
  if (!mode) return null
  return (
    <>
      <button type="button" className={className} style={style}
        onClick={(e) => { e.stopPropagation(); mode === 'prompt' ? prompt() : setHelp(true) }}>
        <DownloadIcon /> {label}
      </button>
      {help && createPortal(<IosHelp onClose={() => setHelp(false)} />, document.body)}
    </>
  )
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" style={{ display: 'inline-block', verticalAlign: '-3px', margin: '0 2px' }}>
      <path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

function IosHelp({ onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const step = { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', color: '#c9d1d9', fontSize: 15, lineHeight: 1.45 }
  const num = { flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: 'rgba(56,139,253,.18)', color: '#58a6ff', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(1,4,9,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 100vw)', background: '#161b22', border: '1px solid #30363d', borderBottom: 'none', borderRadius: '18px 18px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', textAlign: 'left', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <img src="/apple-touch-icon.png" width="44" height="44" alt="" style={{ borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <div id="ios-install-title" style={{ color: '#f0f6fc', fontWeight: 700, fontSize: 17 }}>Install LifeSOC</div>
            <div style={{ color: '#8b949e', fontSize: 13 }}>Opens full-screen from your home screen, like an app.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={step}><span style={num}>1</span><span>Tap the <b>Share</b> button <ShareIcon /> in your browser's toolbar.</span></div>
        <div style={step}><span style={num}>2</span><span>Scroll down and tap <b>Add to Home Screen</b>.</span></div>
        <div style={step}><span style={num}>3</span><span>Tap <b>Add</b>. LifeSOC appears on your home screen.</span></div>
      </div>
    </div>
  )
}
