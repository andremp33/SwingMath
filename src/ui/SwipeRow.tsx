import { Trash2 } from 'lucide-react'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useT } from '../i18n'
import { cx } from './basics'

/** Width of the action a swipe uncovers (px). */
const ACTION = 88
/** Past this share of the row, letting go deletes (a full swipe). */
const FULL = 0.55
/** How far a finger moves before the gesture picks an axis (px). */
const SLOP = 10
/** A critically damped spring that settles in about this long (s). */
const RESPONSE = 0.35

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Where a flick would come to rest: the scroll view's deceleration. */
const project = (v: number, rate = 0.99) => ((v / 1000) * rate) / (1 - rate)

/** Past an edge the row follows less and less, never stopping hard. */
const rubberband = (over: number, size: number) => (over * size * 0.55) / (size + 0.55 * Math.abs(over))

/**
 * A list row the player can swipe left to uncover Delete, as phones do; a
 * full swipe deletes. The button is a real one in the tab order: focusing
 * it slides the row open, so a keyboard needs no gesture. Vertical drags
 * stay the page's (touch-action: pan-y). One row is open at a time.
 */
export function SwipeRow({
  label,
  open,
  onOpenChange,
  onDelete,
  className,
  children,
}: {
  /** The delete button's name, e.g. "Apagar Aero #1". */
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  /** The card's own look (it sits over the action). */
  className?: string
  children: ReactNode
}) {
  const t = useT()
  const row = useRef<HTMLLIElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLDivElement>(null)
  const icon = useRef<HTMLSpanElement>(null)
  const x = useRef(0)
  const target = useRef(0)
  const frame = useRef(0)
  const armed = useRef(false)
  const gone = useRef(false)
  // A drag that moved the row is not also a tap on what is under the finger.
  const dragged = useRef(false)
  const drag = useRef<{ id: number; x0: number; y0: number; from: number; axis?: 'x' | 'y'; trail: { x: number; t: number }[] } | null>(null)

  const paint = (v: number) => {
    x.current = v
    card.current!.style.transform = v ? `translate3d(${v}px, 0, 0)` : ''
    action.current!.style.opacity = v < 0 ? '1' : '0'
    // Armed, the icon leaves the edge and rides with the row, as on iOS.
    const w = row.current!.offsetWidth
    const arm = v < -w * FULL
    if (arm !== armed.current) {
      armed.current = arm
      if (arm && drag.current) navigator.vibrate?.(8)
      // The jump to the edge eases; after that the icon tracks 1:1.
      const st = icon.current!.style
      st.transition = reduced() ? '' : 'transform 200ms var(--ease-out)'
      setTimeout(() => (st.transition = ''), 200)
    }
    icon.current!.style.transform = arm ? `translate3d(${v + ACTION}px, 0, 0)` : ''
  }

  /** Springs to `to` from where the row is now, carrying `v` (px/s). */
  const springTo = (to: number, v = 0, done?: () => void) => {
    cancelAnimationFrame(frame.current)
    target.current = to
    const from = x.current
    if (reduced() || from === to) {
      paint(to)
      done?.()
      return
    }
    const w = (2 * Math.PI) / RESPONSE
    const a = from - to
    const b = v + w * a
    const t0 = performance.now()
    const step = (now: number) => {
      const s = (now - t0) / 1000
      const at = to + (a + b * s) * Math.exp(-w * s)
      if (s > 0.1 && Math.abs(at - to) < 0.5) {
        paint(to)
        done?.()
        return
      }
      paint(at)
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  /** Slides the row out, folds its space away, then deletes. */
  const commit = (v = 0) => {
    if (gone.current) return
    gone.current = true
    const li = row.current!
    const fold = () => {
      if (reduced()) return onDelete()
      const h = li.offsetHeight
      li.animate([{ height: `${h}px` }, { height: '0px', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }).finished.then(
        onDelete,
        onDelete,
      )
    }
    springTo(-li.offsetWidth, Math.min(v, 0), fold)
  }

  // Opened or closed from outside (another row, focus, a tap elsewhere).
  useEffect(() => {
    if (drag.current?.axis === 'x' || gone.current) return
    const to = open ? -ACTION : 0
    if (target.current !== to) springTo(to)
    // springTo reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // An open row closes when the player touches anything else.
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, onOpenChange])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const down = (e: ReactPointerEvent) => {
    if (gone.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    cancelAnimationFrame(frame.current)
    dragged.current = false
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: x.current, trail: [] }
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const dx = e.clientX - d.x0
    if (!d.axis) {
      const dy = e.clientY - d.y0
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        // The page scrolls; put the row back where it was.
        drag.current = null
        springTo(target.current)
        return
      }
      d.axis = 'x'
      dragged.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      getSelection()?.removeAllRanges()
      onOpenChange(true)
    }
    d.trail = [...d.trail.filter((p) => e.timeStamp - p.t < 100), { x: e.clientX, t: e.timeStamp }]
    const v = d.from + dx
    paint(v > 0 ? rubberband(v, ACTION) : v)
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (d.axis !== 'x') return
    const [first, last] = [d.trail[0], d.trail.at(-1)]
    const v = first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0
    const w = row.current!.offsetWidth
    // A full swipe deletes, unless the finger was already pulling back.
    if (e.type === 'pointerup' && x.current < -w * FULL && v < 300) return commit(v)
    const keep = x.current + project(v) < -ACTION / 2
    springTo(keep ? -ACTION : 0, v)
    onOpenChange(keep)
  }

  return (
    <li ref={row} className="relative isolate min-w-0 overflow-hidden rounded-lg">
      <div
        ref={card}
        className={cx('relative z-10 touch-pan-y', className)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          // A drag, or a tap on an open row, only moves the row.
          if (dragged.current) {
            e.preventDefault()
            e.stopPropagation()
            dragged.current = false
            return
          }
          if (open) {
            e.preventDefault()
            e.stopPropagation()
            onOpenChange(false)
          }
        }}
      >
        {children}
      </div>
      {/* Clear of the card's left corners, which would fringe it red. */}
      <div ref={action} className="absolute inset-y-0 right-0 left-6 flex justify-end rounded-lg bg-danger opacity-0">
        <button
          type="button"
          aria-label={label}
          onFocus={() => onOpenChange(true)}
          onBlur={(e) => {
            if (!row.current?.contains(e.relatedTarget)) onOpenChange(false)
          }}
          onClick={() => commit()}
          className="flex w-[88px] shrink-0 flex-col items-center justify-center gap-1 text-xs font-semibold text-bg focus-visible:outline-bg focus-visible:-outline-offset-4"
        >
          <span ref={icon} className="flex flex-col items-center gap-1">
            <Trash2 className="size-5" strokeWidth={1.75} aria-hidden />
            {t.common.delete}
          </span>
        </button>
      </div>
    </li>
  )
}
