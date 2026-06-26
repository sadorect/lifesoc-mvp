import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import Hls from 'hls.js'

// ── API helpers ────────────────────────────────────────────────────────────

function useApiGet(path, getToken) {
  const [data,    setData]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    setLoading(true)
    // Fetch a fresh token per request — Clerk session tokens expire after ~60s.
    getToken()
      .then(token => fetch(path, { headers: { Authorization: `Bearer ${token}` } }))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setData)
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }, [path, getToken])

  return { data, loading, error }
}

// ── Player ─────────────────────────────────────────────────────────────────

function Player({ chapter, getToken, canDownload, onClose, onEnded }) {
  const audioRef  = useRef(null)
  const hlsRef    = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [current,  setCurrent]  = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!chapter) return
    let cancelled = false
    const audio = audioRef.current
    const src   = `/api/audiobook/playlist?chapter=${encodeURIComponent(chapter.id)}`

    setLoading(true)
    setError(null)
    setPlaying(false)
    setCurrent(0)
    setDuration(0)

    // Fetch a fresh token before loading. The playlist + AES key requests fire
    // immediately (well within the ~60s token life); segments need no token.
    getToken().then(token => {
      if (cancelled) return

      if (Hls.isSupported()) {
        const hls = new Hls({
          // Attach the Clerk token ONLY to our own API (playlist + key endpoints).
          // Segment URLs are pre-signed R2 links — adding any header there
          // triggers a CORS preflight and conflicts with R2's signature.
          xhrSetup(xhr, url) {
            if (url.includes('/api/audiobook/')) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`)
            }
          },
        })
        hlsRef.current = hls
        hls.loadSource(src)
        hls.attachMedia(audio)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          audio.play().then(() => setPlaying(true)).catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setError('Playback error. Please try again.')
        })
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari) — token can't be injected, so pass it as a query param
        audio.src = `${src}&token=${encodeURIComponent(token)}`
        audio.addEventListener('loadedmetadata', () => {
          setLoading(false)
          audio.play().then(() => setPlaying(true)).catch(() => {})
        }, { once: true })
      } else {
        setError('Your browser does not support HLS playback.')
        setLoading(false)
      }
    })

    return () => { cancelled = true; hlsRef.current?.destroy(); hlsRef.current = null }
  }, [chapter?.id, getToken])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    playing ? audio.pause() : audio.play()
    setPlaying(!playing)
  }

  const seek = e => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const fmt = s => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handleDownload = async () => {
    const token = await getToken()
    const res  = await fetch(`/api/audiobook/download?chapter=${encodeURIComponent(chapter.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { url } = await res.json()
    const a = document.createElement('a')
    a.href = url
    a.download = `${chapter.title}.mp3`
    a.click()
  }

  return (
    <div style={S.player}>
      <div style={S.playerHeader}>
        <span style={S.playerTitle}>{chapter.title}</span>
        <button onClick={onClose} style={S.iconBtn}>✕</button>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={e => setCurrent(e.target.currentTime)}
        onDurationChange={e => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); onEnded?.() }}
        style={{ display: 'none' }}
      />

      {error  && <p style={{ color: 'var(--red)', padding: '0 16px', fontSize: 13 }}>{error}</p>}

      {/* Progress bar */}
      <div onClick={seek} style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: duration ? `${(current / duration) * 100}%` : '0%' }} />
      </div>
      <div style={S.timestamps}>
        <span>{fmt(current)}</span>
        <span>{duration ? fmt(duration) : '--:--'}</span>
      </div>

      {/* Controls */}
      <div style={S.controls}>
        <button onClick={() => { audioRef.current.currentTime -= 15 }} style={S.iconBtn} title="-15s">⏮</button>
        <button onClick={togglePlay} style={S.playBtn} disabled={loading}>
          {loading ? '…' : playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => { audioRef.current.currentTime += 30 }} style={S.iconBtn} title="+30s">⏭</button>
        {canDownload && (
          <button onClick={handleDownload} style={{ ...S.iconBtn, marginLeft: 8 }} title="Download MP3">⬇</button>
        )}
      </div>
    </div>
  )
}

// ── Chapter list ───────────────────────────────────────────────────────────

export default function Audiobook() {
  const { getToken } = useAuth()
  const [active, setActive] = useState(null)

  const { data, loading, error } = useApiGet('/api/audiobook/chapters', getToken)

  if (loading) return <div style={S.center}>Loading…</div>
  if (error)   return <div style={S.center}>Failed to load chapters.</div>

  const { parts, canDownload } = data
  const flat = parts.flatMap(p => p.chapters)

  const playNext = () => {
    const i = flat.findIndex(c => c.id === active?.id)
    if (i >= 0 && i < flat.length - 1) setActive(flat[i + 1])
  }

  return (
    <div style={S.root}>

      {parts.map(part => (
        <div key={part.title} style={S.part}>
          <p style={S.partTitle}>{part.title}</p>
          {part.chapters.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActive(ch)}
              style={{ ...S.chapterRow, ...(active?.id === ch.id ? S.chapterActive : {}) }}
            >
              <span style={S.chapterDot}>{active?.id === ch.id ? '▶' : '○'}</span>
              {ch.title}
            </button>
          ))}
        </div>
      ))}

      {active && (
        <Player
          chapter={active}
          getToken={getToken}
          canDownload={canDownload}
          onClose={() => setActive(null)}
          onEnded={playNext}
        />
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  root:         { padding: '16px 16px 180px', color: 'var(--text-1)' },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-3)' },
  heading:      { fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' },
  part:         { marginBottom: 24 },
  partTitle:    { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 },
  chapterRow:   { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 4, cursor: 'pointer', color: 'var(--text-1)', fontSize: 14, textAlign: 'left' },
  chapterActive:{ background: 'var(--blue)', color: '#fff', border: '1px solid var(--blue)' },
  chapterDot:   { fontSize: 10, flexShrink: 0, width: 14, textAlign: 'center' },

  player:       { position: 'fixed', bottom: 60, left: 0, right: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '12px 16px 16px', zIndex: 50 },
  playerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  playerTitle:  { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' },
  progressTrack:{ height: 4, background: 'var(--border)', borderRadius: 2, cursor: 'pointer', margin: '0 0 6px' },
  progressFill: { height: '100%', background: 'var(--blue)', borderRadius: 2, transition: 'width 0.5s linear' },
  timestamps:   { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 10 },
  controls:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 },
  playBtn:      { width: 48, height: 48, borderRadius: '50%', background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtn:      { background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 18, padding: '4px 8px' },
}
