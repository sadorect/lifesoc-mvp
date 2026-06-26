import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{ baseTheme: undefined, variables: { colorBackground: '#161b22', colorInputBackground: '#21262d', colorInputText: '#e6edf3', colorText: '#e6edf3', colorTextSecondary: '#8b949e', colorPrimary: '#388bfd', colorDanger: '#f85149', borderRadius: '8px' } }}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
