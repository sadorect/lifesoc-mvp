// Privacy Policy and Terms of Service links (static pages served by the server).
export default function LegalLinks({ style }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: 0, ...style }}>
      <a href="/privacy" style={link}>Privacy Policy</a>
      <span aria-hidden="true" style={{ margin: '0 8px' }}>·</span>
      <a href="/terms" style={link}>Terms of Service</a>
    </p>
  )
}

const link = { color: 'var(--text-2)', textDecoration: 'underline', textUnderlineOffset: 2 }
