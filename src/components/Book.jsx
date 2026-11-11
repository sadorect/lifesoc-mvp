import { useState } from 'react'
import Audiobook from './Audiobook.jsx'
import EbookReader from './EbookReader.jsx'
import { TalkButton, useMessages } from './Messages.jsx'

export default function Book() {
  const [mode, setMode] = useState('listen') // 'listen' | 'read'
  const messages = useMessages()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Listen / Read toggle */}
      <div style={S.toggleBar}>
        <div style={S.toggle}>
          <button
            onClick={() => setMode('listen')}
            style={{ ...S.toggleBtn, ...(mode === 'listen' ? S.toggleActive : {}) }}
          >
            🎧 Listen
          </button>
          <button
            onClick={() => setMode('read')}
            style={{ ...S.toggleBtn, ...(mode === 'read' ? S.toggleActive : {}) }}
          >
            📖 Read
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <TalkButton onClick={messages.open} unread={messages.unread} style={{ padding: '7px 12px', fontSize: 13 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {mode === 'listen' ? <Audiobook /> : <EbookReader />}
      </div>
    </div>
  )
}

const S = {
  toggleBar:   { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' },
  toggle:      { display: 'flex', background: 'var(--bg-raised)', borderRadius: 10, padding: 3, gap: 3 },
  toggleBtn:   { flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' },
  toggleActive:{ background: 'var(--blue)', color: '#fff' },
}
