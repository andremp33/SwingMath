import { fmt } from '../i18n'
import { useLegal } from '../i18n/legal'
import { OWNER, OWNER_ADDRESS, SUPPORT_EMAIL } from '../lib/owner'
import { BackTitle } from '../ui/BackTitle'
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
  const doc = useLegal(kind)
  return (
    <article className="mx-auto max-w-2xl">
      <BackTitle fallback="/perfil">{doc.title}</BackTitle>
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
