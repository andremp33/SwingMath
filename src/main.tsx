import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { IS_APP, IS_NATIVE } from './lib/platform'
import { ensureOwned } from './data/db'
import { useStore } from './data/store'
import { loadLang } from './i18n'

// A new version takes over as soon as it is downloaded (the page reloads
// itself), and the app checks for one whenever it comes back to the front.
if (IS_NATIVE) {
  // Status bar, back button, sign-in links: only in the store apps.
  // A load cut short (the page left at once) is not an error.
  void import('./lib/native')
    .then((m) => m.initNative())
    .catch(() => {})
  // The app's preview in a phone's browser has neither (see src/preview/).
} else if (!IS_APP) registerSW({
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

// The first screen waits for its language (each one is a chunk of its own).
void loadLang(useStore.getState().lang).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
