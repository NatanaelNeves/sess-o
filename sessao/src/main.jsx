import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './typography.css'
import './index.css'
import './v3.css'
import App, { ErrorBoundary } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
