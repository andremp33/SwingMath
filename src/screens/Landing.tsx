import { ArrowRight, Check, CircleCheck, Globe, NotebookPen, Scale, Target, Wifi } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import type { Lang } from '../i18n'
import { fmt } from '../i18n'
import { useLanding } from '../i18n/landing'
import { useLegal } from '../i18n/legal'
import { cx } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { PRICING } from '../lib/entitlement'
import { usePrice } from './Pro'

const FEATURE_ICONS = [Scale, CircleCheck, Target, NotebookPen, Globe, Wifi]

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || undefined
const OWNER = (import.meta.env.VITE_OWNER_NAME as string | undefined) || 'SwingMath'

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
  return (
    <div role="radiogroup" aria-label="Language" className="flex gap-1 text-sm">
      {(['pt', 'es', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cx('rounded-md px-2 py-1 uppercase', lang === l ? 'font-medium text-text underline decoration-accent decoration-2 underline-offset-[6px]' : 'text-muted hover:text-text')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function SiteFrame({ children }: { children: React.ReactNode }) {
  const t = useLanding()
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <Link to="/sobre" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-7" />
          SwingMath
        </Link>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <Link to="/" className="hidden rounded-md bg-text px-4 py-2 text-sm font-medium text-bg hover:opacity-90 sm:inline-flex">
            {t.cta}
          </Link>
        </div>
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
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-text">
              {t.contact}
            </a>
          )}
        </nav>
      </footer>
    </div>
  )
}

const Cta = ({ label, big }: { label: string; big?: boolean }) => (
  <Link
    to="/"
    className={cx(
      'inline-flex items-center gap-2 rounded-md bg-accent font-medium text-on-accent transition hover:opacity-90',
      big ? 'h-12 px-6 text-base' : 'h-11 px-5',
    )}
  >
    {label} <ArrowRight className="size-5" aria-hidden />
  </Link>
)

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')

const Section = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={cx('mx-auto max-w-[1080px] px-4 pt-20 lg:px-8', className)} aria-labelledby={slug(title)}>
    <h2 id={slug(title)} className="mb-6 text-xl font-semibold tracking-tight">
      {title}
    </h2>
    {children}
  </section>
)

export function Landing() {
  const t = useLanding()
  const price = usePrice()
  useTitle(t.meta)

  return (
    <SiteFrame>
      <section className="mx-auto grid max-w-[1080px] items-center gap-10 px-4 pt-10 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-16">
        <div>
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[44px] lg:text-[52px] lg:leading-[1.04]">{t.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.heroSub}</p>
          <div className="mt-8">
            <Cta label={t.cta} big />
          </div>
        </div>
        <div className="relative">
          <img
            src={`${import.meta.env.BASE_URL}landing/app-mobile.png`}
            alt={t.shotAlt}
            width={390}
            height={844}
            className="mx-auto w-full max-w-[300px] rounded-[28px] border border-border"
            loading="eager"
          />
        </div>
      </section>

      <Section title={t.problemTitle}>
        <div className="grid gap-4 md:grid-cols-2">
          {t.problems.map(([h, p]) => (
            <div key={h} className="border-t border-border pt-4">
              <h3 className="font-semibold">{h}</h3>
              <p className="mt-2 text-muted">{p}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t.howTitle}>
        <ol className="grid gap-4 md:grid-cols-3">
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {t.also.map((x) => (
            <li key={x} className="flex gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
              {x}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.pricingTitle}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold">{t.free}</h3>
            <p className="text-sm text-muted">{t.freeFor}</p>
            <p className="readout mt-4 text-[36px] leading-none">{price(0)}</p>
            <ul className="mt-4 space-y-2">
              {t.freeItems.map((x) => (
                <li key={x} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-text/60 p-6">
            <h3 className="text-lg font-semibold">{t.pro}</h3>
            <p className="text-sm text-muted">{t.proFor}</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="readout text-[36px] leading-none">{price(PRICING.monthly)}</span>
              <span className="text-muted">{t.proPer}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{fmt(t.proTerms, { annual: price(PRICING.annual), days: PRICING.trialDays })}</p>
            <ul className="mt-4 space-y-2">
              {t.proItems.map((x) => (
                <li key={x} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title={t.faqTitle}>
        <div className="divide-y divide-border border-y border-border">
          {t.faq.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {q}
                  <span className="text-muted transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-[1080px] px-4 pt-20 text-center lg:px-8">
        <h2 className="text-xl font-semibold tracking-tight">{t.finalTitle}</h2>
        <div className="mt-6">
          <Cta label={t.cta} big />
        </div>
      </section>
    </SiteFrame>
  )
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const doc = useLegal(kind)
  useTitle(`${doc.title} — SwingMath`)
  const fill = (s: string) => fmt(s, { email: SUPPORT_EMAIL ?? '—', owner: OWNER })
  return (
    <SiteFrame>
      <article className="mx-auto max-w-[720px] px-4 pt-8 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted">{doc.updated}</p>
        {doc.sections.map(([h, p]) => (
          <section key={h} className="mt-8">
            <h2 className="text-lg font-semibold">{h}</h2>
            <p className="mt-2 leading-relaxed text-muted">{fill(p)}</p>
          </section>
        ))}
      </article>
    </SiteFrame>
  )
}
