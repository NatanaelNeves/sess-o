import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './typography.css'
import './index.css'
import './v3.css'
import App, { ErrorBoundary } from './App.jsx'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'

// No app Android (Capacitor) o site já vem dentro do APK: um service worker só
// serviria arquivos velhos depois de uma atualização. No navegador ele mantém o PWA offline.
if (Capacitor.isNativePlatform()) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
} else {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
