import { ChevronDown, CircleHelp } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Card, cx } from './basics'
import { Sheet } from './overlay'

/** A (?) that opens the explanation in a sheet, instead of small print. */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t.common.info}: ${title}`}
        className="-m-1.5 inline-flex shrink-0 items-center justify-center rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-text"
      >
        <CircleHelp className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
      {/* Rendered at the end of the page, so it can sit inside text and titles. */}
      {createPortal(
        <Sheet open={open} onClose={() => setOpen(false)} title={title}>
          <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        </Sheet>,
        document.body,
      )}
    </>
  )
}

const KEY = (id: string) => `swingmath-open:${id}`
const OPEN_EVENT = 'swingmath-open'

/**
 * Opens a collapsible card from elsewhere (a link, another page) and scrolls
 * to it once it is on screen. Remembered like a tap on its title.
 */
export function openCollapsible(id: string) {
  try {
    localStorage.setItem(KEY(id), '1')
  } catch {
    // Not remembered; the event below still opens it.
  }
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
  // The card may be on a page that is still loading: look for a second.
  let tries = 0
  const find = () => {
    const el = document.getElementById(`card-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else if (tries++ < 60) requestAnimationFrame(find)
  }
  requestAnimationFrame(find)
}

/** Open on wide screens (from `openFrom` px), closed on phones, until the
 *  player chooses. */
function useOpen(id: string, openFrom = 1024): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY(id))
      if (saved !== null) return saved === '1'
    } catch {
      // Storage may be unavailable; fall back to the screen size.
    }
    return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${openFrom}px)`).matches
  })
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<string>).detail === id && setOpen(true)
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [id])
  return [
    open,
    (v) => {
      setOpen(v)
      try {
        localStorage.setItem(KEY(id), v ? '1' : '0')
      } catch {
        // Not remembered; fine.
      }
    },
  ]
}

/** A card whose body opens and closes. Closed, it shows a one-line summary. */
export function CollapsibleCard({ id, title, summary, info, openFrom, children }: { id: string; title: string; summary?: ReactNode; info?: ReactNode; openFrom?: number; children: ReactNode }) {
  const [open, setOpen] = useOpen(id, openFrom)
  const bodyId = useId()
  return (
    <Card label={title} id={`card-${id}`} className="scroll-mt-20">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between gap-3 py-1 text-left"
          >
            <span className="min-w-0">
              <span className="block text-md font-semibold tracking-tight">{title}</span>
              {!open && summary && <span className="num line-clamp-2 text-sm text-muted">{summary}</span>}
            </span>
            <ChevronDown className={cx('size-5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} strokeWidth={1.75} aria-hidden />
          </button>
        </h2>
        {info}
      </div>
      {open && (
        <div id={bodyId} className="mt-3">
          {children}
        </div>
      )}
    </Card>
  )
}
