import { ArrowLeft, ArrowRight, Mail, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STOCK_RACKETS } from '../data/rackets'
import { defaultConfig, useStore } from '../data/store'
import { compute } from '../domain/physics'
import { emptyLead } from '../domain/types'
import type { Lang } from '../i18n'
import { fmt, loadLang, useT } from '../i18n'
import { useLanding } from '../i18n/landing'
import { useLegal } from '../i18n/legal'
import { decodeShare } from '../lib/share'
import { fmtNum, fmtSigned, leadParts } from '../lib/format'
import { SUPPORT_EMAIL } from '../lib/owner'
import { cx } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { LegalBody } from './Legal'
import { DEMO_RACKETS } from './demoRackets'
import { LeadDemo } from './LeadDemo'
import { bedLabel } from '../lib/bedLabel'
import { useUnits } from '../lib/units'

/**
 * The website: the store apps' shop window. What the app does (with the
 * app's own physics running in the first screen), the store buttons, the
 * legal and support pages the stores ask for, and a preview of shared setups
 * that tries to open the app.
 */

const APP_STORE_URL = (import.meta.env.VITE_APP_STORE_URL as string | undefined) || undefined
const PLAY_STORE_URL = (import.meta.env.VITE_PLAY_STORE_URL as string | undefined) || undefined
const APP_SCHEME = 'app.swingmath://'
const onPhone = () => /Android|iPhone|iPad/.test(navigator.userAgent)
const img = (name: string) => `${import.meta.env.BASE_URL}landing/${name}`
/** The order of a part in its section's entrance. */
const stagger = (i: number) => ({ '--i': i }) as CSSProperties

function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}

/** Parts marked data-reveal rise into place once, as their section arrives.
 *  Without script, or with reduced motion, they are simply there. */
function useReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const root = document.documentElement
    root.classList.add('site-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      root.classList.remove('site-reveal')
    }
  }, [])
}

function LangSwitch() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const t = useLanding()
  return (
    <div role="radiogroup" aria-label={t.language} className="flex gap-1 text-[15px]">
      {(['pt', 'es', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => void loadLang(l).then(() => setLang(l))}
          className={cx('site-press rounded-md px-2 py-1 uppercase', lang === l ? 'font-medium text-text underline decoration-accent decoration-2 underline-offset-[6px]' : 'text-muted hover:text-text')}
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
      <a key={name} href={url} target="_blank" rel="noopener" className="site-press inline-flex h-12 items-center gap-2.5 rounded-md bg-text px-4 text-bg hover:opacity-90">
        <Smartphone className="size-5" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[13px] opacity-80">{t.getOn}</span>
          <span className="block font-semibold">{name}</span>
        </span>
      </a>
    ) : (
      <span key={name} className="inline-flex h-12 items-center gap-2.5 rounded-md bg-surface-2 px-4 text-muted">
        <Smartphone className="size-5" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[13px]">{t.soon}</span>
          <span className="block font-semibold text-text">{name}</span>
        </span>
      </span>
    )
  return <div className={cx('flex flex-wrap gap-3', className)}>{[one(t.appStore, APP_STORE_URL), one(t.playStore, PLAY_STORE_URL)]}</div>
}

const SECTIONS = ['como', 'app', 'planos', 'perguntas']
const YEAR = new Date().getFullYear()

function SiteFrame({ children, front = false }: { children: ReactNode; front?: boolean }) {
  const t = useLanding()
  return (
    <div className="min-h-dvh">
      <header className="site-wrap flex h-[84px] items-center justify-between gap-6">
        <Link to="/" className="site-press flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-7" />
          SwingMath
        </Link>
        <div className="flex items-center gap-8">
          {front && (
            <nav aria-label="SwingMath" className="hidden gap-7 text-[15px] lg:flex">
              {t.nav.map((label, i) => (
                <a key={label} href={`#${SECTIONS[i]}`} className="site-link">
                  {label}
                </a>
              ))}
            </nav>
          )}
          <LangSwitch />
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className={cx('site-wrap pb-8 text-[15px]', front ? 'mt-[24svh]' : 'mt-24')}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-6">
          <span className="text-muted">{t.footerWhat}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-1">
            <Link to="/privacidade" className="site-link">
              {t.privacy}
            </Link>
            <Link to="/termos" className="site-link">
              {t.terms}
            </Link>
            <Link to="/suporte" className="site-link">
              {t.support}
            </Link>
            <Link to="/apagar-conta" className="site-link">
              {t.deleteAccount}
            </Link>
          </nav>
          <span className="text-muted md:text-right">© {YEAR} SwingMath</span>
        </div>
        {front && <p className="mt-6 max-w-[90ch] text-[15px] leading-6 text-muted">{t.credits}</p>}
      </footer>
    </div>
  )
}

export function Landing() {
  const t = useLanding()
  useTitle(t.meta)
  useReveal()
  return (
    <SiteFrame front>
      <Hero />
      <HowItWorks />
      <InTheApp />
      <Plans />
      <Questions />
      <Close />
    </SiteFrame>
  )
}

function Hero() {
  const t = useLanding()
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="site-wrap site-grid pt-10 lg:pt-[96px]">
        <div className="relative z-10 col-span-12 lg:col-span-6">
          <h1 id="hero-title" className="site-display site-rise">
            {t.heroTitle}
          </h1>
          <p className="site-rise site-hero-text mt-8 max-w-[38ch] text-[18px] leading-[1.55]" style={stagger(1)}>
            {t.heroSub}
          </p>
          <div className="site-rise" style={stagger(2)}>
            <StoreButtons className="mt-8" />
          </div>
        </div>
      </div>
      <div className="site-stage mt-12 xl:mt-[-136px]">
        <div className="site-shutter">
          <img src={img('clay.jpg')} alt="" width={1920} height={1280} className="site-stage-img" fetchPriority="high" />
        </div>
        <div className="site-stage-inner relative">
          <p className="site-stage-label mb-3 text-[15px] font-medium">{t.demoTitle}</p>
          <LeadDemo />
        </div>
      </div>
    </section>
  )
}

/** A cropped piece of the app, as wide as the reading column. */
const Fragment = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div data-ui data-reveal className={cx('site-fragment mt-5 rounded-lg border border-border bg-surface p-4 text-[14px]', className)} style={stagger(1)}>
    {children}
  </div>
)

function HowItWorks() {
  const t = useLanding()
  const ta = useT()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const units = useUnits()
  const pa = DEMO_RACKETS[0]
  const run = (leadG: ReturnType<typeof emptyLead>) => compute({ spec: pa, ...defaultConfig(pa.id), leadG, masses }).result
  const tip = { base: run(emptyLead()), result: run({ ...emptyLead(), tip: 4 }) }
  const checked = run({ ...emptyLead(), tip: 2, threeNine: 2 })
  // A measurement as a player might bring back from the scale and the machine.
  const measured = { weightG: Math.round(checked.weightG) + 1, balanceCm: Math.round(checked.balanceCm * 10 - 1) / 10, swingweight: Math.round(checked.swingweight) + 2 }
  const checkRows = [
    [ta.spec.weight, units.weight(checked.weightG), units.weight(measured.weightG), units.weightDelta(measured.weightG - checked.weightG, 0), units.weightUnit],
    [ta.spec.balance, units.balance(checked.balanceCm), units.balance(measured.balanceCm), units.balanceDelta(measured.balanceCm - checked.balanceCm, 0), units.balanceUnit],
    [ta.spec.swingweight, fmtNum(checked.swingweight, 0, lang), fmtNum(measured.swingweight, 0, lang), fmtSigned(measured.swingweight - checked.swingweight, 0, lang), ''],
  ]
  const evidence = [
    <Fragment key="lib">
      <p className="flex justify-between font-semibold">
        {t.libraryTitle} <span className="num font-normal text-muted">{STOCK_RACKETS.length}</span>
      </p>
      <ul className="mt-2">
        {DEMO_RACKETS.slice(0, 3).map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-x-4 border-t border-border py-2 first:border-t-0">
            <span>
              <span className="text-muted">{r.brand}</span> <span className="font-medium">{r.model}</span>
            </span>
            <span className="num text-muted">
              {units.weight(r.weightG)} {units.weightUnit} · {units.balance(r.balanceCm)} {units.balanceUnit} · SW {fmtNum(r.swingweight, 0, lang)}
            </span>
          </li>
        ))}
      </ul>
    </Fragment>,
    <Fragment key="tip">
      <p className="font-semibold">
        {pa.brand} {pa.model} · {t.sweetTitle}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[
          [ta.spec.sweetSpot, units.balanceDelta(tip.result.sweetSpotCm - tip.base.sweetSpotCm, 0), units.balanceUnit],
          [ta.spec.swingweight, fmtSigned(tip.result.swingweight - tip.base.swingweight, 1, lang), ''],
          [ta.spec.balance, units.balanceDelta(tip.result.balanceCm - tip.base.balanceCm), units.balanceUnit],
        ].map(([k, v, u]) => (
          <div key={k}>
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="readout text-[20px] text-accent-text">
              {v} <span className="text-[13px] font-normal text-muted">{u}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Fragment>,
    <Fragment key="check">
      <p className="font-semibold">{t.checkTitle}</p>
      <table className="num mt-2 w-full text-left">
        <thead>
          <tr className="text-[13px] text-muted">
            <th scope="col" className="py-1 font-normal">
              <span className="sr-only">{ta.spec.weight}</span>
            </th>
            {t.checkCols.map((c) => (
              <th key={c} scope="col" className="py-1 text-right font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {checkRows.map(([k, p, m, d, u]) => (
            <tr key={k} className="border-t border-border">
              <th scope="row" className="py-2 font-normal text-muted">
                {k}
              </th>
              <td className="py-2 text-right">
                {p} <span className="text-muted">{u}</span>
              </td>
              <td className="py-2 text-right">
                {m} <span className="text-muted">{u}</span>
              </td>
              <td className="py-2 text-right font-medium">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Fragment>,
    <Fragment key="journal" className="max-w-[420px]">
      <p className="font-semibold">Pure Aero #1</p>
      <p className="text-muted">
        {pa.brand} {pa.model}
      </p>
      <p className="mt-3 flex items-baseline justify-between gap-3">
        <span className="readout text-[20px]">{fmt(t.restringLeft, { n: 14 })}</span>
        <span className="text-[13px] text-muted">{fmt(t.restringLife, { n: 75 })}</span>
      </p>
      <span className="mt-2 block h-2 rounded-full bg-surface-2">
        <span className="block h-2 w-3/4 rounded-full bg-success" />
      </span>
      <p className="mt-3 text-[13px] text-muted">{t.restringMeta}</p>
    </Fragment>,
  ]
  return (
    <section id="como" aria-labelledby="como-title" className="site-wrap site-grid site-section">
      <figure className="col-span-12 mt-16 max-w-[480px] lg:sticky lg:max-w-none lg:top-24 lg:col-span-4 lg:mt-0 lg:self-start" data-reveal>
        <img src={img('garsault-1767.jpg')} alt={t.garsault} width={1290} height={1947} loading="lazy" className="site-photo aspect-[4/5] w-full object-cover object-[50%_20%] lg:aspect-auto" />
        <figcaption className="mt-3 text-[15px] text-muted">{t.garsault}</figcaption>
      </figure>
      <div className="order-first col-span-12 lg:order-none lg:col-span-6 lg:col-start-6">
        <h2 id="como-title" className="site-h2" data-reveal>
          {t.howTitle}
        </h2>
        <div className="mt-12 space-y-[72px] max-lg:space-y-14">
          {t.how.map(([lead, rest], i) => (
            <div key={lead}>
              <p className="text-[18px] leading-[1.6] text-muted" data-reveal>
                <strong className="font-semibold text-text">{lead}</strong> {fmt(rest, { n: STOCK_RACKETS.length })}
              </p>
              {evidence[i]}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const SCREENS = ['app-calculator.png', 'app-measure.png', 'app-strings.png', 'app-match.png']

function InTheApp() {
  const t = useLanding()
  const row = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const el = row.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const at = box.left + box.width * (window.innerWidth >= 1024 ? 0.35 : 0.5)
      let best = 0
      let bestD = Infinity
      Array.from(el.children).forEach((c, i) => {
        const r = c.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - at)
        if (d < bestD) [best, bestD] = [i, d]
      })
      setActive(best)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  const go = (i: number) => {
    const target = row.current?.children[Math.max(0, Math.min(SCREENS.length - 1, i))] as HTMLElement | undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }
  const [name, text] = t.app[active]
  return (
    <section id="app" aria-labelledby="app-title" className="site-dark site-section-gap py-20 lg:py-28">
      <div className="site-wrap">
        <h2 id="app-title" className="site-h2" data-reveal>
          {t.appTitle}
        </h2>
      </div>
      <div className="site-showcase relative mt-12 lg:mt-16">
        <ul ref={row} className="site-row" tabIndex={0} aria-label={t.appTitle}>
          {SCREENS.map((src, i) => (
            <li key={src} className={cx('site-panel', i === active && 'is-lit')} onClick={() => go(i)}>
              <img src={img(src)} alt={t.app[i][2]} width={390} height={844} loading="lazy" className="block h-auto w-full rounded-lg" />
            </li>
          ))}
        </ul>
        <div className="site-panel-text" aria-live="polite">
          <p key={name} className="site-swap text-[22px] font-medium leading-tight">
            {name}
          </p>
          <p key={text} className="site-swap mt-3 text-[18px] leading-[1.55] text-[var(--site-dark-muted)]">
            {text}
          </p>
          <div className="mt-8 flex gap-2">
            <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label={t.appPrev} className="site-press site-round">
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(active + 1)} disabled={active === SCREENS.length - 1} aria-label={t.appNext} className="site-press site-round">
              <ArrowRight className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Plans() {
  const t = useLanding()
  const last = t.planCols.length - 1
  return (
    <section id="planos" aria-labelledby="planos-title" className="site-wrap site-section">
      <h2 id="planos-title" className="site-h2" data-reveal>
        {t.plansTitle}
      </h2>
      <table className="site-plans mt-12 hidden w-full lg:table" data-reveal>
        <thead>
          <tr>
            <th scope="col" className="w-5/12 text-left">
              <span className="sr-only">{t.planWhat}</span>
            </th>
            {t.planCols.map((c, i) => (
              <th key={c} scope="col" className={cx('text-left text-[18px] font-semibold', i === last && 'is-pro')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.planRows.map(([what, ...cells]) => (
            <tr key={what}>
              <th scope="row" className="text-left text-[22px] font-medium leading-snug">
                {what}
              </th>
              {cells.map((c, i) => (
                <td key={i} className={cx('text-[18px]', i === last && 'is-pro')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-10 space-y-2 lg:hidden" data-reveal>
        {t.planRows.map(([what, ...cells]) => (
          <li key={what} className="site-plan-block rounded-md px-4 py-4">
            <h3 className="text-[22px] font-semibold leading-snug">{what}</h3>
            <dl className="mt-2 space-y-1 text-[16px]">
              {cells.map((c, i) => (
                <div key={i} className={cx('flex justify-between gap-4', i === last && '-mx-4 -mb-4 mt-2 rounded-b-md bg-accent px-4 py-2 text-on-accent')}>
                  <dt className={i === last ? '' : 'text-muted'}>{t.planCols[i]}</dt>
                  <dd className="text-right font-medium">{c}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <p className="mt-8 max-w-[60ch] text-[18px] leading-[1.55]" data-reveal>
        {t.proNote}
      </p>
    </section>
  )
}

function Questions() {
  const t = useLanding()
  return (
    <section id="perguntas" aria-labelledby="perguntas-title" className="site-wrap site-grid site-section">
      <h2 id="perguntas-title" className="site-h2 col-span-12 self-start lg:sticky lg:top-24 lg:col-span-4" data-reveal>
        {t.faqTitle}
      </h2>
      <div className="col-span-12 mt-10 space-y-2 lg:col-span-8 lg:mt-0">
        {t.faq.map(([q, a], i) => (
          <details key={q} name="faq" className="site-tile group rounded-md" data-reveal style={stagger(i)}>
            <summary className="site-press-soft flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-6 px-6 py-4 text-[22px] font-medium leading-snug marker:hidden max-sm:min-h-16 max-sm:text-[18px]">
              {q}
              <span className="site-plus" aria-hidden />
            </summary>
            <p className="max-w-[52ch] px-6 pb-6 text-[18px] leading-[1.55] max-sm:text-[16px]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Close() {
  const t = useLanding()
  return (
    <section aria-labelledby="close-title" className="site-wrap site-grid site-section items-center">
      <div className="col-span-12 lg:col-span-6">
        <h2 id="close-title" className="site-h2-large" data-reveal>
          {t.finalTitle}
        </h2>
        <p className="mt-6 text-[18px]" data-reveal style={stagger(1)}>
          {t.finalSub}
        </p>
        <div data-reveal style={stagger(2)}>
          <StoreButtons className="mt-8" />
        </div>
      </div>
      <figure className="col-span-12 mt-14 lg:col-span-6 lg:col-start-7 lg:mt-0" data-reveal style={stagger(1)}>
        <img src={img('ballmacher-1768.jpg')} alt={t.ballmacher} width={1920} height={1272} loading="lazy" className="site-photo aspect-[16/10] w-full object-cover object-[25%_35%]" />
        <figcaption className="mt-3 text-[15px] text-muted">{t.ballmacher}</figcaption>
      </figure>
    </section>
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
        <a href={`mailto:${SUPPORT_EMAIL}`} className="site-press mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-text px-5 font-medium text-bg hover:opacity-90">
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
      <button type="button" onClick={open} className="site-press inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-medium text-on-accent hover:opacity-90">
        <Smartphone className="size-5" aria-hidden /> {t.shareOpen}
      </button>
      <div>
        <p className="mb-3 text-sm text-muted">{t.shareGet}</p>
        <StoreButtons />
      </div>
    </div>
  )
}
