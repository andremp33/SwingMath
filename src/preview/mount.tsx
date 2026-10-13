import { createRoot } from 'react-dom/client'
import { usePreviewText } from './text'
import './preview.css'

function Strip() {
  const { strip } = usePreviewText()
  return (
    <aside aria-label={strip} className="preview-strip">
      {strip}
    </aside>
  )
}

// The strip at the top, under the status bar, on every screen. Only the
// preview's page loads this file (vite.config.ts), so no store build has it.
const el = document.createElement('div')
document.body.prepend(el)
createRoot(el).render(<Strip />)
