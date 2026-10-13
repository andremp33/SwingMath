import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'
import { useBack, useSwipeBack } from './back'

/** A subpage's top: back (button and edge swipe) and its title. */
export function BackTitle({ children, fallback }: { children: ReactNode; fallback: string }) {
  const t = useT()
  const back = useBack(fallback)
  useSwipeBack(back)
  return (
    <header className="mb-5 flex min-h-11 items-center gap-1">
      <button type="button" onClick={back} aria-label={t.common.back} className="-ml-2 rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text">
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <h1 className="min-w-0 text-xl font-semibold tracking-tight">{children}</h1>
    </header>
  )
}
