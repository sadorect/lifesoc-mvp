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
  const [pageDraft, setPageDraft] = useState('')
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

  // A stored page can outrun a newly published edition with fewer pages.
  useEffect(() => {
    if (numPages && page > numPages) setPage(numPages)
  }, [numPages, page])

  // Keep the jump box showing the current page whenever it isn't being edited.
  useEffect(() => { setPageDraft(String(page)) }, [page])

  const go = delta => setPage(p => Math.min(Math.max(p + delta, 1), numPages || 1))

  const commitDraft = () => {
    const n = parseInt(pageDraft, 10)
    if (Number.isNaN(n)) return setPageDraft(String(page))
    setPage(Math.min(Math.max(n, 1), numPages || 1))
  }

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
          <span style={S.pageNum}>
            <input
              value={pageDraft}
              onChange={e => setPageDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={e => e.target.select()}
              onBlur={commitDraft}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitDraft(); e.target.blur() }
                if (e.key === 'Escape') { setPageDraft(String(page)); e.target.blur() }
              }}
              inputMode="numeric"
              aria-label="Go to page"
              style={S.pageInput}
            />
            <span style={S.pageTotal}>/ {numPages}</span>
          </span>
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
  pageNum:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' },
  pageInput: {
    width: 48, boxSizing: 'border-box', padding: '6px 4px', textAlign: 'center',
    fontSize: 13, color: 'var(--text-1)', background: 'var(--bg-raised)',
    border: '1px solid var(--border)', borderRadius: 6,
  },
  pageTotal: { fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap' },
}
