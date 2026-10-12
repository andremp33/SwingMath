import type { CustomerInfo, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor'
import type { License } from '../data/store'

/**
 * Store subscriptions in the Android and iOS apps, through RevenueCat. The
 * public SDK keys (appl_..., goog_...) are safe in the app; the secret key
 * only lives in the webhook (supabase/functions/rc-webhook).
 * Pure logic here, so it is tested without the native plugin.
 */

/** The entitlement the RevenueCat dashboard grants with either plan. */
export const ENTITLEMENT = 'pro'

const env = import.meta.env
export function rcKey(platform: string): string | undefined {
  const key = platform === 'ios' ? env.VITE_RC_IOS_KEY : platform === 'android' ? env.VITE_RC_ANDROID_KEY : undefined
  return (key as string | undefined) || undefined
}

/** What the store says about Pro, as the app keeps it. Null when the player
 *  never had it on this store account. */
export function licenseFrom(info: CustomerInfo, now = Date.now()): License | null {
  const e = info.entitlements.active[ENTITLEMENT] ?? info.entitlements.all[ENTITLEMENT]
  if (!e) return null
  return {
    provider: 'store',
    activatedAt: e.originalPurchaseDateMillis,
    checkedAt: now,
    status: e.isActive ? 'active' : 'ended',
    expiresAt: e.expirationDate,
    willRenew: e.willRenew,
    trial: e.periodType === 'TRIAL',
  }
}

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }

/** Length of the free trial the store offers on a product, in days. iOS
 *  calls it a free introductory price; Google Play, a free phase. */
export function trialDays(p: PurchasesStoreProduct): number | null {
  const intro = p.introPrice
  if (intro && intro.price === 0) return intro.periodNumberOfUnits * (DAYS[intro.periodUnit] ?? 0) || null
  const free = p.defaultOption?.freePhase?.billingPeriod
  if (free) return free.value * (DAYS[free.unit] ?? 0) || null
  return null
}
