import { ChevronLeft } from 'lucide-react'
import { fmt, useT } from '../i18n'
import { useLegal } from '../i18n/legal'
import { OWNER, OWNER_ADDRESS, SUPPORT_EMAIL } from '../lib/owner'
import { useBack, useSwipeBack } from '../ui/back'
import { cx } from '../ui/basics'
import { Sheet } from '../ui/overlay'

export type LegalKind = 'privacy' | 'terms'

/** The privacy policy or the terms. The website's copy adds what the site
 *  itself does; everything else is the same text, with the same date. */
export function LegalBody({ kind, web, large }: { kind: LegalKind; web?: boolean; large?: boolean }) {
  const doc = useLegal(kind)
  const fill = (s: string) => fmt(s, { email: SUPPORT_EMAIL ?? '—', owner: OWNER, address: OWNER_ADDRESS ?? '—' })
  return (
    <>
      <p className="text-sm text-muted">{doc.updated}</p>
      {[...doc.sections, ...(web ? doc.web : [])].map(([h, p]) => (
        <section key={h} className={large ? 'mt-8' : 'mt-6'}>
          <h2 className={cx('font-semibold tracking-tight', large ? 'text-lg' : 'text-md')}>{h}</h2>
          <p className={cx('mt-2 leading-relaxed text-muted', !large && 'text-sm')}>{fill(p)}</p>
        </section>
      ))}
    </>
  )
}

/** In the app: a screen of its own, with a way back (button and edge swipe). */
export function LegalScreen({ kind }: { kind: LegalKind }) {
  const t = useT()
  const doc = useLegal(kind)
  const back = useBack('/settings')
  useSwipeBack(back)
  return (
    <article className="mx-auto max-w-2xl">
      <header className="mb-3 flex min-h-11 items-center gap-1">
        <button type="button" onClick={back} aria-label={t.common.back} className="-ml-2 rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <h1 className="min-w-0 text-xl font-semibold tracking-tight">{doc.title}</h1>
      </header>
      <LegalBody kind={kind} />
    </article>
  )
}

/** Over the paywall: read the terms or the policy without leaving it. */
export function LegalSheet({ kind, onClose }: { kind: LegalKind | null; onClose: () => void }) {
  const doc = useLegal(kind ?? 'terms')
  return (
    <Sheet open={kind !== null} onClose={onClose} title={doc.title}>
      {kind && <LegalBody kind={kind} />}
    </Sheet>
  )
}
