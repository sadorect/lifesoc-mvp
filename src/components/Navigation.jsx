const ITEMS = [
  { id: 'dashboard', label: 'SOC',       svg: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> },
  { id: 'cve',       label: 'CVEs',      svg: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></> },
  { id: 'patches',   label: 'Patches',   svg: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></> },
  { id: 'scan',      label: 'Scan',      svg: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></> },
  { id: 'incidents', label: 'IR Log',    svg: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  { id: 'analyst',   label: 'Analyst',   svg: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></> }
]

export default function Navigation({ active, onSelect }) {
  return (
    <nav style={{
      background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
      display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 8px)'
    }}>
      {ITEMS.map(item => {
        const isActive = active === item.id
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '2px', padding: '10px 4px 6px', border: 'none', background: 'none',
            color: isActive ? 'var(--blue)' : 'var(--text-3)', cursor: 'pointer',
            transition: 'color 0.15s'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {item.svg}
            </svg>
            <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400, letterSpacing: '0.02em' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
