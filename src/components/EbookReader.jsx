import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Bundle the pdf.js worker through Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const STORAGE_KEY = 'ebook-page'

export default function EbookReader() {
  const { getToken } = useAuth()
  const containerRef = useRef(null)

  const [fileUrl,  setFileUrl]  = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [page,     setPage]     = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || 1)
  const [width,    setWidth]    = useState(0)
  const [error,    setError]    = useState(null)

  // Fetch a signed URL for the PDF
  useEffect(() => {
    getToken()
      .then(token => fetch('/api/ebook/url', { headers: { Authorization: `Bearer ${token}` } }))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ url }) => setFileUrl(url))
      .catch(() => setError('Could not load the book.'))
  }, [getToken])

  // Track container width so pages render full-width on any screen
  useEffect(() => {
    const measure = () => setWidth(containerRef.current?.clientWidth ?? 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [fileUrl])

  // Remember last page
  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(page)) }, [page])

  const go = delta => setPage(p => Math.min(Math.max(p + delta, 1), numPages || 1))

  if (error) return <div style={S.center}>{error}</div>

  return (
    <div style={S.root} ref={containerRef}>
      {!fileUrl ? (
        <div style={S.center}>Loading book…</div>
      ) : (
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError('Could not open the PDF.')}
          loading={<div style={S.center}>Loading book…</div>}
        >
          <Page
            pageNumber={page}
            width={width || undefined}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
      )}

      {numPages && (
        <div style={S.pager}>
          <button onClick={() => go(-1)} disabled={page <= 1} style={S.pagerBtn}>‹ Prev</button>
          <span style={S.pageNum}>{page} / {numPages}</span>
          <button onClick={() => go(1)} disabled={page >= numPages} style={S.pagerBtn}>Next ›</button>
        </div>
      )}
    </div>
  )
}

const S = {
  root:     { padding: '0 0 140px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  center:   { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-3)' },
  pager:    { position: 'fixed', bottom: 60, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '10px 16px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', zIndex: 50 },
  pagerBtn: { background: 'var(--bg-raised)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' },
  pageNum:  { fontSize: 13, color: 'var(--text-2)', minWidth: 70, textAlign: 'center' },
}
