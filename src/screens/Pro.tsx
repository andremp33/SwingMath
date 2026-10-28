import { Check, Lock, Sparkles } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import type { Plan } from '../lib/entitlement'
import { offerCopy, savingPct, trialSteps, type PaywallReason } from '../lib/paywall'
import { IS_PREVIEW } from '../lib/platform'
import type { StorePlan } from '../lib/purchases'
import { Badge, Button, Card, cx } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { AppOnly } from '../preview/text'
import { PaywallTop } from './PaywallPreview'
import { LegalSheet, type LegalKind } from './Legal'
import { useReminders } from './reminders'
import { forgetPlans, loadPlans, useTrialDays } from './storePlans'

type OpenPaywall = (reason: PaywallReason, opts?: { asked?: boolean }) => void
const PaywallCtx = createContext<OpenPaywall>(() => {})

/** Opens the Pro sheet, saying why. `asked`: the player tapped to see the
 *  plans; otherwise a limit opened it, which happens once per session. */
export const usePaywall = () => useContext(PaywallCtx)

/** A paywall nobody asked for opens once per session; after that, a note. */
let unaskedShown = false

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<PaywallReason | null>(null)
  const toast = useToast()
  const t = useT()
  const seen = useStore((s) => s.setProNudgeAt)
  const show = useCallback<OpenPaywall>(
    (r, opts) => {
      if (!opts?.asked) {
        if (unaskedShown) return toast(t.paywall.isPro, { label: t.paywall.seePro, run: () => (seen(Date.now()), setReason(r)) })
        unaskedShown = true
      }
      // Just seen: the reminder of Pro waits another week.
      seen(Date.now())
      setReason(r)
    },
    [toast, t, seen],
  )
  return (
    <PaywallCtx.Provider value={show}>
      {children}
      <Sheet open={reason !== null} onClose={() => setReason(null)} title={t.pro.title}>
        {reason && <ProPanel reason={reason} onDone={() => setReason(null)} />}
      </Sheet>
    </PaywallCtx.Provider>
  )
}

/** Pro as the player has it, or the plans to get it (the stores' own). */
export function ProPanel({ reason, onDone }: { reason: PaywallReason; onDone?: () => void }) {
  const t = useT()
  // The free days a walkthrough gave before are Pro, but the plans are still for sale.
  const paid = useStore((s) => isPro({ ...s, freeProUntil: null }))
  if (paid) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="pro">Pro</Badge>
        <span className="text-sm">{t.pro.active}</span>
      </div>
    )
  }
  return <StorePanel reason={reason} onDone={onDone} />
}

const storeName = () => (/iPhone|iPad|Mac/.test(navigator.userAgent) ? 'App Store' : 'Google Play')

/**
 * The store apps' paywall: the player's own racket, report or fleet (else
 * why it opened), three outcomes, what stays free,
 * the plans with the store's own prices (annual chosen), and the renewal
 * terms both stores ask for next to the button. The X is there from the start.
 */
function StorePanel({ reason, onDone }: { reason: PaywallReason; onDone?: () => void }) {
  const t = useT()
  const toast = useToast()
  const license = useStore((s) => s.license)
  const freeProUntil = useStore((s) => s.freeProUntil)
  const [now] = useState(() => Date.now())
  const [plans, setPlans] = useState<StorePlan[] | null>(null)
  const [plan, setPlan] = useState<Plan>('annual')
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null)
  const [legal, setLegal] = useState<LegalKind | null>(null)
  const reminders = useReminders()

  useEffect(() => {
    let live = true
    void loadPlans().then((p) => live && setPlans(p))
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
          forgetPlans()
          toast(t.pro.active)
          onDone?.()
          // The trial's end is a reminder; it needs the notifications.
          if (chosen!.trialDays && reminders.supported && reminders.permission === 'default') void reminders.enable()
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
      {freeProUntil !== null && now >= freeProUntil && <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm">{t.paywall.freeProEnded}</p>}
      <PaywallTop reason={reason} />
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
        IS_PREVIEW ? (
          <AppOnly />
        ) : (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{t.pro.notConfigured}</p>
        )
      ) : (
        <>
          {chosen.trialDays && <TrialSteps days={chosen.trialDays} />}
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
          {/* Stays at the bottom of the sheet while the rest scrolls: the
              price and the button are always in view. */}
          <div className="sticky -bottom-4 -mx-5 space-y-2 border-t border-border bg-surface px-5 pb-4 pt-3">
            <Button variant="primary" icon={Sparkles} className="h-12 w-full" loading={busy === 'buy'} disabled={busy !== null} onClick={() => run('buy')}>
              {copy(chosen).cta}
            </Button>
            <p className="text-xs text-muted">{copy(chosen).legal}</p>
          </div>
        </>
      )}
      {!IS_PREVIEW && (
        <Button variant="ghost" className="w-full" loading={busy === 'restore'} disabled={busy !== null} onClick={() => run('restore')}>
          {t.pro.restore}
        </Button>
      )}
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

/** The trial, day by day: what it gives, when we remind, when the plan
 *  starts. Said before the button, so nothing about it is a surprise. */
function TrialSteps({ days }: { days: number }) {
  const t = useT()
  const p = t.paywall
  const text = { today: p.trialTodayText, remind: p.trialRemindText, charge: fmt(p.trialChargeText, { store: storeName() }) }
  return (
    <section aria-labelledby="trial-title" className="rounded-lg bg-surface-2 px-4 py-3" data-testid="trial-steps">
      <h3 id="trial-title" className="font-semibold">
        {fmt(p.trialTitle, { days })}
      </h3>
      <ol className="mt-2 space-y-2">
        {trialSteps(days).map((s) => (
          <li key={s.kind} className="flex gap-3 text-sm">
            <span className="num w-14 shrink-0 font-medium text-accent-text">{s.day === 0 ? p.trialToday : fmt(p.trialDay, { n: s.day })}</span>
            <span>{text[s.kind]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Pro content, or for everyone else the lock (in a card, unless `bare`:
 * already inside one). With `preview`, the lock sits over that, blurred:
 * made-up numbers showing what Pro adds, never the player's own (those
 * stay out of the page).
 */
export function ProGate({ children, title, reason, bare, preview }: { children: ReactNode; title: string; reason: PaywallReason; bare?: boolean; preview?: ReactNode }) {
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const t = useT()
  const trialDays = useTrialDays()
  if (pro) return <>{children}</>
  const body = (
    <>
      <Lock className="size-7 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{t.pro.locked}</p>
      </div>
      <Button variant="primary" icon={Sparkles} onClick={() => paywall(reason, { asked: true })}>
        {trialDays ? fmt(t.pro.unlockTrial, { days: trialDays }) : t.pro.unlock}
      </Button>
    </>
  )
  if (preview)
    return (
      // Tall enough for the lock, however short the preview.
      <div className="relative min-h-48">
        <div aria-hidden inert className="pointer-events-none blur-sm select-none">
          {preview}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 p-4 text-center">{body}</div>
      </div>
    )
  if (bare) return <div className="flex flex-col items-center gap-3 py-6 text-center">{body}</div>
  return <Card className="flex flex-col items-center gap-3 py-10 text-center">{body}</Card>
}
