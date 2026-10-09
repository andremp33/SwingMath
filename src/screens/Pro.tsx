import { Check, Lock, Sparkles } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import {
  activateLicense,
  annualSaving,
  CHECKOUT,
  deactivateLicense,
  LicenseError,
  needsCheck,
  PLANS,
  PORTAL_URL,
  PRICING,
  revalidate,
  storeConfigured,
  type Plan,
} from '../lib/entitlement'
import { fmtDate, LOCALE } from '../lib/format'
import { Badge, Button, Card, cx, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'

const PaywallCtx = createContext<(reason?: string) => void>(() => {})

/** Opens the Pro sheet. Pass a reason to say why it appeared. */
export const usePaywall = () => useContext(PaywallCtx)

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
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>()
  const show = useCallback((r?: string) => {
    setReason(r)
    setOpen(true)
  }, [])
  const t = useT()
  useLicenseCheck()
  return (
    <PaywallCtx.Provider value={show}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.pro.title}>
        {reason && <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-sm">{reason}</p>}
        <ProPanel onDone={() => setOpen(false)} />
      </Sheet>
    </PaywallCtx.Provider>
  )
}

export function usePrice() {
  const lang = useStore((s) => s.lang)
  const nf = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: PRICING.currency })
  const whole = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: PRICING.currency, maximumFractionDigits: 0 })
  return (n: number) => (Number.isInteger(n) ? whole : nf).format(n)
}

/** Subscribe: pick a plan, start the trial, or activate a key. */
export function ProPanel({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const toast = useToast()
  const price = usePrice()
  const license = useStore((s) => s.license)
  const setLicense = useStore((s) => s.setLicense)
  const pro = useStore(isPro)
  const [plan, setPlan] = useState<Plan>('annual')
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

  const amount = (p: Plan) => (p === 'monthly' ? PRICING.monthly : PRICING.annual)
  const url = CHECKOUT[plan] ?? CHECKOUT.monthly ?? CHECKOUT.annual

  return (
    <div className="space-y-4">
      {license && license.status !== 'active' && <LapsedNote />}
      <p className="font-semibold">{fmt(t.pro.trial, { days: PRICING.trialDays })}</p>
      <ul className="space-y-2">
        {t.pro.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            {f}
          </li>
        ))}
      </ul>

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

/** The Pro card in Settings. */
export function ProStatus() {
  const t = useT()
  const s = useStore()
  const pro = useStore(isPro)
  if (!pro) return <ProPanel />
  const l = s.license!
  return (
    <div className="space-y-3">
      <p className="text-sm">{fmt(t.pro.activeSince, { date: fmtDate(l.activatedAt, s.lang) })}</p>
      {l.expiresAt && <p className="text-sm text-muted">{fmt(t.pro.renews, { date: fmtDate(Date.parse(l.expiresAt), s.lang) })}</p>}
      <div className="flex flex-wrap gap-2">
        {PORTAL_URL && l.provider === 'lemonsqueezy' && (
          <a href={PORTAL_URL} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-2">
            {t.pro.manage}
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await deactivateLicense(l)
            s.setLicense(null)
          }}
        >
          {t.pro.deactivate}
        </Button>
      </div>
    </div>
  )
}

/** Shows children for Pro users; otherwise a card that opens the paywall.
 *  `bare` drops the card when it already sits inside one. */
export function ProGate({ children, title, bare }: { children: ReactNode; title: string; bare?: boolean }) {
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
      <Button variant="primary" icon={Sparkles} onClick={() => paywall()}>
        {t.pro.unlock}
      </Button>
    </>
  )
  if (bare) return <div className="flex flex-col items-center gap-3 py-6 text-center">{body}</div>
  return <Card className="flex flex-col items-center gap-3 py-10 text-center">{body}</Card>
}
