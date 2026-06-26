import { useState } from 'react'
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import Navigation from './components/Navigation.jsx'
import Dashboard from './components/Dashboard.jsx'
import CVERegister from './components/CVERegister.jsx'
import PatchTracker from './components/PatchTracker.jsx'
import IoCScanner from './components/IoCScanner.jsx'
import IncidentLog from './components/IncidentLog.jsx'
import AIAnalyst from './components/AIAnalyst.jsx'
import Book from './components/Book.jsx'

const TABS = ['dashboard', 'cve', 'patches', 'scan', 'incidents', 'analyst', 'book']

export default function App() {
  const [tab, setTab] = useState('dashboard')

  return (
    <>
      <SignedOut>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          background: 'var(--bg-base)',
        }}>
          <SignIn routing="hash" />
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-base)' }}>
          <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
            {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
            {tab === 'cve'       && <CVERegister />}
            {tab === 'patches'   && <PatchTracker />}
            {tab === 'scan'      && <IoCScanner />}
            {tab === 'incidents' && <IncidentLog />}
            {tab === 'analyst'   && <AIAnalyst />}
            {tab === 'book'      && <Book />}
          </main>
          <Navigation active={tab} onSelect={setTab} />
        </div>
      </SignedIn>
    </>
  )
}
