import { Check, Lock, Sparkles } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { FREE_SETUP_LIMIT, isPro, useStore, type Account } from '../data/store'
import { fmt, useT } from '../i18n'
import {
  activateLicense,
  annualSaving,
  CHECKOUT,
  LicenseError,
  needsCheck,
  PLANS,
  PRICING,
  revalidate,
  storeConfigured,
  type Plan,
  type WebPlan,
} from '../lib/entitlement'
import { LOCALE } from '../lib/format'
import { IS_APP } from '../lib/platform'
import { offerCopy, savingPct, type PaywallReason } from '../lib/paywall'
import type { StorePlan } from '../lib/purchases'
import { Badge, Button, Card, cx, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { LegalSheet, type LegalKind } from './Legal'

type OpenPaywall = (reason: PaywallReason, opts?: { asked?: boolean }) => void
const PaywallCtx = createContext<OpenPaywall>(() => {})

/** Opens the Pro sheet, saying why. `asked`: the player tapped to see the
 *  plans; otherwise a limit opened it, which happens once per session. */
export const usePaywall = () => useContext(PaywallCtx)

/** A paywall nobody asked for opens once per session; after that, a note. */
let unaskedShown = false

/** Checks the subscription again every few days, when the app is opened. */
function useLicenseCheck() {
  const license = useStore((s) => s.license)
  const setLicense = useStore((s) => s.setLicense)
  const toast = useToast()
  const t = useT()
  useEffect(() => {
    const check = async () => {
      const current = useStore.getState().license
      if (!needsCheck(current) || !navigator.onLine) return
      const next = await revalidate(current!).catch(() => current!)
      if (next.status === 'ended' && current!.status !== 'ended') toast(t.pro.ended)
      setLicense(next)
    }
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [license?.key, setLicense, toast, t])
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<PaywallReason | null>(null)
  const toast = useToast()
  const t = useT()
  const show = useCallback<OpenPaywall>(
    (r, opts) => {
      if (!opts?.asked) {
        if (unaskedShown) return toast(t.paywall.isPro, { label: t.paywall.seePro, run: () => setReason(r) })
        unaskedShown = true
      }
      setReason(r)
    },
    [toast, t],
  )
  useLicenseCheck()
  return (
    <PaywallCtx.Provider value={show}>
      {children}
      <Sheet open={reason !== null} onClose={() => setReason(null)} title={t.pro.title}>
        {reason && <ProPanel reason={reason} onDone={() => setReason(null)} />}
      </Sheet>
    </PaywallCtx.Provider>
  )
}

/** Signed in: the checkout carries the account, so the subscription is
 *  linked to it (and Pro follows the account) without a key. */
function checkoutUrl(base: string | undefined, account: Account | null) {
  if (!base || !account) return base
  const u = new URL(base)
  u.searchParams.set('checkout[email]', account.email)
  u.searchParams.set('checkout[custom][user_id]', account.userId)
  return u.toString()
}

export function usePrice() {
  const lang = useStore((s) => s.lang)
  const nf = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: PRICING.currency })
  const whole = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: PRICING.currency, maximumFractionDigits: 0 })
  return (n: number) => (Number.isInteger(n) ? whole : nf).format(n)
}

/** Subscribe: pick a plan, start the trial, or activate a key. */
export function ProPanel({ reason, onDone }: { reason: PaywallReason; onDone?: () => void }) {
  const t = useT()
  const toast = useToast()
  const price = usePrice()
  const license = useStore((s) => s.license)
  const account = useStore((s) => s.account)
  const setLicense = useStore((s) => s.setLicense)
  const pro = useStore(isPro)
  const [plan, setPlan] = useState<WebPlan>('annual')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [showKey, setShowKey] = useState(false)

  if (pro) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="pro">Pro</Badge>
        <span className="text-sm">{t.pro.active}</span>
      </div>
    )
  }
  // The store apps sell through the App Store and Google Play only.
  if (IS_APP) return <StorePanel reason={reason} onDone={onDone} />

  const activate = async () => {
    setBusy(true)
    setError(undefined)
    try {
      setLicense(await activateLicense(key))
      toast(t.pro.active)
      onDone?.()
    } catch (e) {
      const kind = e instanceof LicenseError ? e.kind : 'invalid'
      setError(kind === 'offline' ? t.pro.offline : kind === 'config' ? t.pro.notConfigured : t.pro.invalidKey)
    } finally {
      setBusy(false)
    }
  }

  const amount = (p: WebPlan) => (p === 'monthly' ? PRICING.monthly : PRICING.annual)
  const url = checkoutUrl(CHECKOUT[plan] ?? CHECKOUT.monthly ?? CHECKOUT.annual, account)

  return (
    <div className="space-y-4">
      {license && license.status !== 'active' && <LapsedNote />}
      <ReasonHeader reason={reason} />
      <p className="font-semibold">{fmt(t.pro.trial, { days: PRICING.trialDays })}</p>
      <Features />

      <fieldset>
        <legend className="sr-only">{t.pro.title}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map((p) => (
            <label
              key={p}
              className={cx(
                'relative flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                plan === p ? 'border-text bg-surface-2' : 'border-border hover:border-text/40',
              )}
            >
              <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="sr-only" />
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {t.pro.plans[p]}
                {p === 'annual' && annualSaving() > 0 && <Badge tone="accent">{fmt(t.pro.save, { n: annualSaving() })}</Badge>}
              </span>
              <span className="num text-lg font-semibold">
                {price(amount(p))}
                <span className="text-sm font-normal text-muted">{t.pro.per[p]}</span>
              </span>
              {p === 'annual' && <span className="num text-xs text-muted">{fmt(t.pro.perMonth, { price: price(PRICING.annual / 12) })}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      {storeConfigured() && url ? (
        <a href={url} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-md bg-text font-semibold text-bg">
          <Sparkles className="size-4" aria-hidden /> {fmt(t.pro.start, { days: PRICING.trialDays })}
        </a>
      ) : (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{t.pro.notConfigured}</p>
      )}
      <p className="text-xs text-muted">{fmt(t.pro.fine, { price: price(amount(plan)), per: t.pro.per[plan] })}</p>

      {!showKey ? (
        <Button variant="ghost" className="w-full" onClick={() => setShowKey(true)}>
          {t.pro.haveKey}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            activate()
          }}
        >
          <TextField label={t.pro.key} value={key} onChange={setKey} error={error} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" autoFocus />
          <Button type="submit" variant="secondary" className="w-full" loading={busy} disabled={key.trim().length < 8}>
            {busy ? t.pro.activating : t.pro.activate}
          </Button>
        </form>
      )}
      {import.meta.env.DEV && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            setLicense({ provider: 'dev', activatedAt: Date.now(), status: 'active' })
            onDone?.()
          }}
        >
          {t.pro.devUnlock}
        </Button>
      )}
    </div>
  )
}

function Features() {
  const t = useT()
  return (
    <ul className="space-y-2">
      {t.pro.features.map((f) => (
        <li key={f} className="flex gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  )
}

const storeName = () => (/iPhone|iPad|Mac/.test(navigator.userAgent) ? 'App Store' : 'Google Play')

/** What opened the paywall, as its title. */
function ReasonHeader({ reason }: { reason: PaywallReason }) {
  const t = useT()
  if (reason === 'profile') return null
  const sub = fmt(t.paywall.subs[reason], { n: FREE_SETUP_LIMIT })
  return (
    <div>
      <h3 className="text-lg font-semibold tracking-tight">{t.paywall.titles[reason]}</h3>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  )
}

/**
 * The store apps' paywall: why it opened, three outcomes, what stays free,
 * the plans with the store's own prices (annual chosen), and the renewal
 * terms both stores ask for next to the button. The X is there from the start.
 */
function StorePanel({ reason, onDone }: { reason: PaywallReason; onDone?: () => void }) {
  const t = useT()
  const toast = useToast()
  const license = useStore((s) => s.license)
  const [plans, setPlans] = useState<StorePlan[] | null>(null)
  const [plan, setPlan] = useState<Plan>('annual')
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null)
  const [legal, setLegal] = useState<LegalKind | null>(null)

  useEffect(() => {
    let live = true
    import('../lib/purchases')
      .then((m) => m.storePlans())
      .catch(() => [])
      .then((p) => live && setPlans(p))
    return () => {
      live = false
    }
  }, [])

  const chosen = plans?.find((p) => p.plan === plan) ?? plans?.[0]
  const saving = savingPct(plans?.find((p) => p.plan === 'annual')?.amount, plans?.find((p) => p.plan === 'monthly')?.amount)
  const copy = (p: StorePlan) => offerCopy(p, t.paywall, storeName())

  const run = async (kind: 'buy' | 'restore') => {
    setBusy(kind)
    try {
      const m = await import('../lib/purchases')
      if (kind === 'buy') {
        if ((await m.buy(chosen!.pkg)) === 'done') {
          toast(t.pro.active)
          onDone?.()
        }
      } else if (await m.restore()) {
        toast(t.pro.restored)
        onDone?.()
      } else toast(t.pro.nothingToRestore)
    } catch {
      toast(t.pro.storeError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {license?.provider === 'store' && license.status === 'ended' && <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm">{t.pro.ended}</p>}
      <ReasonHeader reason={reason} />
      <ul className="space-y-2">
        {t.paywall.benefits.map((f) => (
          <li key={f} className="flex gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-accent-text" strokeWidth={2} aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t.paywall.free}</p>

      {plans === null ? (
        <p className="text-sm text-muted">{t.pro.loadingPlans}</p>
      ) : !chosen ? (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{t.pro.notConfigured}</p>
      ) : (
        <>
          <fieldset>
            <legend className="sr-only">{t.pro.title}</legend>
            <div className="space-y-2">
              {plans.map((p) => {
                const on = chosen.plan === p.plan
                return (
                  <label
                    key={p.plan}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                      on ? 'border-text bg-surface-2' : 'border-border hover:border-text/40',
                    )}
                  >
                    <input type="radio" name="plan" value={p.plan} checked={on} onChange={() => setPlan(p.plan)} className="sr-only" />
                    <span aria-hidden className={cx('grid size-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-text' : 'border-border-input')}>
                      {on && <span className="size-2.5 rounded-full bg-text" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {t.paywall.plans[p.plan]}
                        {p.plan === 'annual' && saving && <Badge tone="accent">{fmt(t.paywall.save, { n: saving })}</Badge>}
                      </span>
                      <span className="num block text-sm text-muted">{copy(p).line}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <Button variant="primary" icon={Sparkles} className="h-12 w-full" loading={busy === 'buy'} disabled={busy !== null} onClick={() => run('buy')}>
            {copy(chosen).cta}
          </Button>
          <p className="text-xs text-muted">{copy(chosen).legal}</p>
        </>
      )}
      <Button variant="ghost" className="w-full" loading={busy === 'restore'} disabled={busy !== null} onClick={() => run('restore')}>
        {t.pro.restore}
      </Button>
      {/* Always there, even before the plans load: the stores ask for both links. */}
      <p className="text-center text-xs text-muted">
        <button type="button" onClick={() => setLegal('terms')} className="underline underline-offset-2">
          {t.settings.terms}
        </button>
        {' · '}
        <button type="button" onClick={() => setLegal('privacy')} className="underline underline-offset-2">
          {t.settings.privacy}
        </button>
      </p>
      <LegalSheet kind={legal} onClose={() => setLegal(null)} />
    </div>
  )
}

/** Why Pro is off, with a way to check again (after renewing, or once online). */
function LapsedNote() {
  const t = useT()
  const toast = useToast()
  const license = useStore((s) => s.license)!
  const setLicense = useStore((s) => s.setLicense)
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-2 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
      <p>{license.status === 'offline' ? t.pro.offlineLong : t.pro.ended}</p>
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          const next = await revalidate({ ...license, checkedAt: 0 }).catch(() => license)
          setLicense(next)
          setBusy(false)
          toast(next.status === 'active' ? t.pro.active : next.status === 'offline' ? t.pro.offline : t.pro.stillEnded)
        }}
      >
        {t.pro.recheck}
      </Button>
    </div>
  )
}

/** Shows children for Pro users; otherwise a card that opens the paywall.
 *  `bare` drops the card when it already sits inside one. */
export function ProGate({ children, title, reason, bare }: { children: ReactNode; title: string; reason: PaywallReason; bare?: boolean }) {
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const t = useT()
  if (pro) return <>{children}</>
  const body = (
    <>
      <Lock className="size-7 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{t.pro.locked}</p>
      </div>
      <Button variant="primary" icon={Sparkles} onClick={() => paywall(reason, { asked: true })}>
        {t.pro.unlock}
      </Button>
    </>
  )
  if (bare) return <div className="flex flex-col items-center gap-3 py-6 text-center">{body}</div>
  return <Card className="flex flex-col items-center gap-3 py-10 text-center">{body}</Card>
}
