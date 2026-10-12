import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { IS_APP } from './lib/platform'
import { ensureOwned } from './data/db'

// A new version takes over as soon as it is downloaded (the page reloads
// itself), and the app checks for one whenever it comes back to the front.
if (IS_APP) {
  // Status bar, back button, sign-in links: only in the store apps.
  void import('./lib/native').then((m) => m.initNative())
} else registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {})
    })
  },
})

// Journals from before owned rackets get theirs, once.
void ensureOwned().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
