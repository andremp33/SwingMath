import { Check, CircleCheck, Globe, Mail, NotebookPen, Scale, Smartphone, Target, Wifi } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STOCK_RACKETS } from '../data/rackets'
import { useStore } from '../data/store'
import { compute } from '../domain/physics'
import type { Lang } from '../i18n'
import { fmt, loadLang, useT } from '../i18n'
import { useLanding } from '../i18n/landing'
import { useLegal } from '../i18n/legal'
import { decodeShare } from '../lib/share'
import { fmtNum, leadParts } from '../lib/format'
import { SUPPORT_EMAIL } from '../lib/owner'
import { cx } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { LegalBody } from './Legal'
import { bedLabel } from '../lib/bedLabel'
import { useUnits } from '../lib/units'

/**
 * The website: the store apps' shop window. What the app does, screenshots,
 * the store buttons, the legal and support pages the stores ask for, and a
 * preview of shared setups that tries to open the app.
 */

const FEATURE_ICONS = [Scale, CircleCheck, Target, NotebookPen, Globe, Wifi]
const APP_STORE_URL = (import.meta.env.VITE_APP_STORE_URL as string | undefined) || undefined
const PLAY_STORE_URL = (import.meta.env.VITE_PLAY_STORE_URL as string | undefined) || undefined
const APP_SCHEME = 'app.swingmath://'
const onPhone = () => /Android|iPhone|iPad/.test(navigator.userAgent)

function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}

function LangSwitch() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const t = useLanding()
  return (
    <div role="radiogroup" aria-label={t.language} className="flex gap-1 text-sm">
      {(['pt', 'es', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => void loadLang(l).then(() => setLang(l))}
          className={cx('rounded-md px-2 py-1 uppercase', lang === l ? 'font-medium text-text underline decoration-accent decoration-2 underline-offset-[6px]' : 'text-muted hover:text-text')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** App Store and Google Play: a link once the app is there, "coming soon" until then. */
export function StoreButtons({ className }: { className?: string }) {
  const t = useLanding()
  const one = (name: string, url: string | undefined) =>
    url ? (
      <a key={name} href={url} target="_blank" rel="noopener" className="inline-flex h-12 items-center gap-2.5 rounded-md bg-text px-4 text-bg hover:opacity-90">
        <Smartphone className="size-5" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[11px] opacity-80">{t.getOn}</span>
          <span className="block font-semibold">{name}</span>
        </span>
      </a>
    ) : (
      <span key={name} className="inline-flex h-12 items-center gap-2.5 rounded-md border border-border px-4 text-muted">
        <Smartphone className="size-5" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[11px]">{t.soon}</span>
          <span className="block font-semibold">{name}</span>
        </span>
      </span>
    )
  return <div className={cx('flex flex-wrap gap-3', className)}>{[one(t.appStore, APP_STORE_URL), one(t.playStore, PLAY_STORE_URL)]}</div>
}

function SiteFrame({ children }: { children: ReactNode }) {
  const t = useLanding()
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-7" />
          SwingMath
        </Link>
        <LangSwitch />
      </header>
      <main id="main">{children}</main>
      <footer className="mx-auto mt-16 flex max-w-[1080px] flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-8 text-sm text-muted lg:px-8">
        <span className="flex items-center gap-2">
          <Logo className="size-5" /> SwingMath
        </span>
        <nav aria-label="Legal" className="flex flex-wrap gap-5">
          <Link to="/privacidade" className="hover:text-text">
            {t.privacy}
          </Link>
          <Link to="/termos" className="hover:text-text">
            {t.terms}
          </Link>
          <Link to="/suporte" className="hover:text-text">
            {t.support}
          </Link>
          <Link to="/apagar-conta" className="hover:text-text">
            {t.deleteAccount}
          </Link>
        </nav>
      </footer>
    </div>
  )
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')

const Section = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <section className={cx('mx-auto max-w-[1080px] px-4 pt-20 lg:px-8', className)} aria-labelledby={slug(title)}>
    <h2 id={slug(title)} className="mb-6 text-xl font-semibold tracking-tight">
      {title}
    </h2>
    {children}
  </section>
)

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <img src={`${import.meta.env.BASE_URL}landing/${src}`} alt={alt} width={390} height={844} className="mx-auto w-full max-w-[260px] rounded-[28px] border border-border" loading="lazy" />
)

const Ticks = ({ items }: { items: string[] }) => (
  <ul className="mt-4 space-y-2">
    {items.map((x) => (
      <li key={x} className="flex gap-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        {x}
      </li>
    ))}
  </ul>
)

export function Landing() {
  const t = useLanding()
  useTitle(t.meta)
  return (
    <SiteFrame>
      <section className="mx-auto grid max-w-[1080px] grid-cols-1 items-center gap-10 px-4 pt-10 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-16">
        <div>
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[44px] lg:text-[52px] lg:leading-[1.04]">{t.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.heroSub}</p>
          <StoreButtons className="mt-8" />
        </div>
        <div className="flex justify-center gap-4">
          <img src={`${import.meta.env.BASE_URL}landing/app-mobile.png`} alt={t.shotAlt} width={390} height={844} className="w-full max-w-[280px] rounded-[28px] border border-border" loading="eager" />
        </div>
      </section>

      <Section title={t.howTitle}>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {t.how.map(([h, p], i) => (
            <li key={h} className="border-t border-border pt-4">
              <span className="num text-sm text-accent-text">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{h}</h3>
              <p className="mt-2 text-muted">{p}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t.featuresTitle}>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {t.features.map(([h, p], i) => {
                const Icon = FEATURE_ICONS[i]
                return (
                  <li key={h} className="border-t border-border pt-4">
                    <Icon className="size-5 text-muted" strokeWidth={1.5} aria-hidden />
                    <h3 className="mt-3 font-semibold">{h}</h3>
                    <p className="mt-2 text-sm text-muted">{p}</p>
                  </li>
                )
              })}
            </ul>
            <h3 className="mb-3 mt-10 text-sm text-muted">{t.alsoTitle}</h3>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {t.also.map((x) => (
                <li key={x} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <Shot src="app-journal.png" alt={t.shotJournalAlt} />
        </div>
      </Section>

      <Section title={t.plansTitle}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold">{t.free}</h3>
            <p className="text-sm text-muted">{t.freeFor}</p>
            <Ticks items={t.freeItems} />
          </div>
          <div className="rounded-lg border border-text/60 p-6">
            <h3 className="text-lg font-semibold">{t.pro}</h3>
            <p className="text-sm text-muted">{t.proFor}</p>
            <Ticks items={t.proItems} />
            <p className="mt-4 text-sm text-muted">{t.proNote}</p>
          </div>
        </div>
      </Section>

      <Section title={t.faqTitle}>
        <div className="divide-y divide-border border-y border-border">
          {t.faq.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="cursor-pointer list-none py-4 font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {q}
                  <span className="text-muted transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <p className="-mt-2 pb-4 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-[1080px] px-4 pt-20 text-center lg:px-8">
        <h2 className="text-xl font-semibold tracking-tight">{t.finalTitle}</h2>
        <StoreButtons className="mt-6 justify-center" />
      </section>
    </SiteFrame>
  )
}

/** A page of the site with one column of text. */
function Page({ title, children }: { title: string; children: ReactNode }) {
  useTitle(`${title} — SwingMath`)
  return (
    <SiteFrame>
      <article className="mx-auto max-w-[720px] px-4 pt-8 lg:px-8">
        <h1 className="mb-1 text-xl font-bold tracking-tight">{title}</h1>
        {children}
      </article>
    </SiteFrame>
  )
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = useLegal(kind)
  return (
    <Page title={doc.title}>
      <LegalBody kind={kind} web large />
    </Page>
  )
}

export function SupportPage() {
  const t = useLanding()
  return (
    <Page title={t.supportTitle}>
      <p className="mt-4 leading-relaxed text-muted">{t.supportText}</p>
      {SUPPORT_EMAIL ? (
        <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-text px-5 font-medium text-bg hover:opacity-90">
          <Mail className="size-5" aria-hidden /> {fmt(t.supportWrite, { email: SUPPORT_EMAIL })}
        </a>
      ) : (
        <p className="mt-6 text-muted">{t.supportNoEmail}</p>
      )}
      <h2 className="mt-12 text-lg font-semibold">{t.faqTitle}</h2>
      <dl className="mt-2 divide-y divide-border">
        {t.faq.map(([q, a]) => (
          <div key={q} className="py-4">
            <dt className="font-semibold">{q}</dt>
            <dd className="mt-1 text-muted">{a}</dd>
          </div>
        ))}
      </dl>
    </Page>
  )
}

/** The page Google Play asks for: how to delete an account, in the app and by email. */
export function DeleteAccountPage() {
  const t = useLanding()
  return (
    <Page title={t.deleteTitle}>
      <p className="mt-4 leading-relaxed text-muted">{t.deleteIntro}</p>
      <h2 className="mt-8 text-lg font-semibold">{t.deleteInAppTitle}</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        {t.deleteInApp.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h2 className="mt-8 text-lg font-semibold">{t.deleteByEmailTitle}</h2>
      <p className="mt-2 leading-relaxed text-muted">{fmt(t.deleteByEmail, { email: SUPPORT_EMAIL ?? '—' })}</p>
      <h2 className="mt-8 text-lg font-semibold">{t.deleteWhatTitle}</h2>
      <p className="mt-2 leading-relaxed text-muted">{t.deleteWhat}</p>
    </Page>
  )
}

/** Tries the app once on a phone, and offers it as a button. */
function useOpenApp(path: string) {
  useEffect(() => {
    if (!onPhone()) return
    const tried = `swingmath-tried:${path}`
    try {
      if (sessionStorage.getItem(tried)) return
      sessionStorage.setItem(tried, '1')
    } catch {
      // Private mode: still try once per visit.
    }
    window.location.href = APP_SCHEME + path
  }, [path])
  return () => {
    window.location.href = APP_SCHEME + path
  }
}

/** A shared setup on the website: what it is, then the app (or the stores). */
export function SharePreview() {
  const { data = '' } = useParams()
  const t = useLanding()
  const ta = useT()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const units = useUnits()
  const open = useOpenApp(`s/${data}`)
  const shared = decodeShare(data)
  const racket = shared && (STOCK_RACKETS.find((r) => r.id === shared.racket.id) ?? { ...shared.racket, createdAt: 0, updatedAt: 0 })
  const result = shared && racket ? compute({ spec: racket, ...shared.setup, masses }).result : null
  return (
    <Page title={shared?.setup.name ?? t.shareTitle}>
      {!shared || !racket || !result ? (
        <p className="mt-4 text-muted">{t.shareBad}</p>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="font-semibold">
            {racket.brand} {racket.model}
            {racket.year ? ` (${racket.year})` : ''}
          </p>
          <p className="num text-muted">{fmt(t.shareSpecs, { w: `${units.weight(result.weightG)} ${units.weightUnit}`, b: `${units.balance(result.balanceCm)} ${units.balanceUnit}`, sw: fmtNum(result.swingweight, 0, lang) })}</p>
          <p className="num text-muted">{leadParts(shared.setup, ta, lang).join(' · ') || ta.setups.noLead}</p>
          {shared.setup.strings && (
            <p className="num text-muted">
              {ta.strings.title}: {bedLabel(shared.setup.strings, ta, lang)}
            </p>
          )}
        </div>
      )}
      <AppOrStores open={open} />
    </Page>
  )
}

/** A stringer's sheet lives in its author's app; the site sends people there. */
export function FichaPreview() {
  const { id = '' } = useParams()
  const t = useLanding()
  const open = useOpenApp(`ficha/${id}`)
  return (
    <Page title={t.fichaTitle}>
      <p className="mt-4 leading-relaxed text-muted">{t.fichaText}</p>
      <AppOrStores open={open} />
    </Page>
  )
}

function AppOrStores({ open }: { open: () => void }) {
  const t = useLanding()
  return (
    <div className="mt-8 space-y-6">
      <button type="button" onClick={open} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-medium text-on-accent hover:opacity-90">
        <Smartphone className="size-5" aria-hidden /> {t.shareOpen}
      </button>
      <div>
        <p className="mb-3 text-sm text-muted">{t.shareGet}</p>
        <StoreButtons />
      </div>
    </div>
  )
}
