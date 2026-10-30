import { Pointer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { cx } from './basics'

/**
 * An instruction shown until the player has done it once (`done`), then
 * never again: remembered in the store, across visits and resets. On the
 * visit where it is done it stays put, so nothing jumps under the finger.
 */
export function OnceHint({ id, done, className, children }: { id: string; done: boolean; className?: string; children: ReactNode }) {
  const seen = useStore((s) => s.hintsDone.includes(id))
  const markHint = useStore((s) => s.markHint)
  const [shown] = useState(() => !seen && !done)
  useEffect(() => {
    if (done && !seen) markHint(id)
  }, [done, seen, id, markHint])
  if (!shown) return null
  return (
    <p className={cx('flex items-start gap-2 text-sm text-muted', className)}>
      <Pointer className="mt-px size-4 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </p>
  )
}
