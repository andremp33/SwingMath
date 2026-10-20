import type { Dict } from '../i18n'
import { fmt } from '../i18n'
import type { Plan } from './entitlement'

/**
 * The paywall's plans and words, as pure functions: the store's prices go
 * in, never prices written in the code.
 */

/** What opened the paywall; its title follows. */
export type PaywallReason = 'solver' | 'journal' | 'fleet' | 'profile'

/** Annual first (and chosen), then lifetime, then monthly. */
export const PLAN_ORDER: Plan[] = ['annual', 'lifetime', 'monthly']

export function orderPlans<T extends { plan: Plan }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan))
}

/** How much the annual plan saves against twelve months, in whole %. */
export function savingPct(annual: number | undefined, monthly: number | undefined): number | null {
  if (!annual || !monthly) return null
  const pct = Math.round((1 - annual / (12 * monthly)) * 100)
  return pct > 0 ? pct : null
}

/** One plan as the store sells it to this player. */
export interface PlanOffer {
  plan: Plan
  /** Formatted by the store, in the player's currency. */
  price: string
  /** Annual only: the price spread over twelve months, by the store. */
  pricePerMonth?: string | null
  /** Only when this player may start a free trial. */
  trialDays: number | null
}

/** The plan's line in the list, its button, and the legal line under it. */
export function offerCopy(o: PlanOffer, t: Dict['paywall'], store: string) {
  if (o.plan === 'lifetime')
    return {
      line: fmt(t.lifetimeLine, { price: o.price }),
      cta: fmt(t.ctaBuy, { price: o.price }),
      legal: fmt(t.legalLifetime, { price: o.price }),
    }
  const per = t.per[o.plan]
  const trial = o.trialDays ? fmt(t.trialPart, { days: o.trialDays }) : ''
  const line =
    o.plan === 'annual'
      ? [fmt(t.annualLine, { price: o.price }), o.pricePerMonth && fmt(t.perMonth, { price: o.pricePerMonth }), trial].filter(Boolean).join(' · ')
      : [`${o.price}${per}`, trial].filter(Boolean).join(' · ')
  return {
    line,
    cta: o.trialDays ? fmt(t.ctaTrial, { days: o.trialDays }) : fmt(t.ctaSubscribe, { price: o.price, per }),
    legal: fmt(o.trialDays ? t.legalTrial : t.legalSub, { price: o.price, per, days: o.trialDays ?? 0, store }),
  }
}
