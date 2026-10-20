import { Capacitor } from '@capacitor/core'
import { INTRO_ELIGIBILITY_STATUS, LOG_LEVEL, Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { useStore } from '../data/store'
import type { Plan } from './entitlement'
import { orderPlans } from './paywall'
import { licenseFrom, rcKey, trialDays } from './storeBilling'

/** Store apps only (loaded on demand): buying, restoring and following Pro
 *  through RevenueCat. Signed in, the RevenueCat user is the account, so the
 *  webhook can give Pro to the account on every device. */

let ready: Promise<boolean> | null = null

function apply(info: CustomerInfo) {
  const s = useStore.getState()
  const l = licenseFrom(info)
  if (l) s.setLicense(l)
  else if (s.license?.provider === 'store') s.setLicense(null)
}

/** Starts the SDK once. False when this build has no key for the platform. */
export function initPurchases(): Promise<boolean> {
  ready ??= (async () => {
    const apiKey = rcKey(Capacitor.getPlatform())
    if (!apiKey) return false
    if (import.meta.env.DEV) await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    await Purchases.configure({ apiKey, appUserID: useStore.getState().account?.userId ?? null })
    await Purchases.addCustomerInfoUpdateListener(apply)
    apply((await Purchases.getCustomerInfo()).customerInfo)
    return true
  })().catch(() => false)
  return ready
}

/** Follows the account: purchases made while signed out move to it. */
export async function identify(userId: string | null) {
  if (!(await initPurchases())) return
  try {
    if (userId) apply((await Purchases.logIn({ appUserID: userId })).customerInfo)
    else if (!(await Purchases.isAnonymous()).isAnonymous) apply((await Purchases.logOut()).customerInfo)
  } catch {
    // Offline: the next start tries again.
  }
}

export interface StorePlan {
  plan: Plan
  pkg: PurchasesPackage
  /** Formatted by the store, in the player's currency. */
  price: string
  /** The bare amount, to work out the annual saving. */
  amount: number
  /** Annual: the store's own price per month. */
  pricePerMonth: string | null
  /** Only when this player may start a free trial. */
  trialDays: number | null
}

/** The plans of the current offering ($rc_annual, $rc_lifetime, $rc_monthly),
 *  with the store's own prices, annual first. */
export async function storePlans(): Promise<StorePlan[]> {
  // Development in a browser: a pretend store, to see the paywall.
  if (import.meta.env.DEV && import.meta.env.VITE_FAKE_STORE === 'true') return (await import('./fakeStore')).fakePlans()
  if (!(await initPurchases())) return []
  const { current } = await Purchases.getOfferings()
  const found = (
    [
      ['annual', current?.annual],
      ['lifetime', current?.lifetime],
      ['monthly', current?.monthly],
    ] as const
  ).filter((x): x is readonly [Plan, PurchasesPackage] => !!x[1])
  // iOS: Apple gives each Apple ID one trial, so ask before promising it.
  // (Google Play only offers the free phase to who may take it.)
  let eligible: Record<string, { status: INTRO_ELIGIBILITY_STATUS }> | null = null
  if (Capacitor.getPlatform() === 'ios')
    eligible = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: found.map(([, p]) => p.product.identifier) }).catch(() => ({}))
  return orderPlans(
    found.map(([plan, pkg]) => {
      const p = pkg.product
      const mayTry = !eligible || eligible[p.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
      return {
        plan,
        pkg,
        price: p.priceString,
        amount: p.price,
        pricePerMonth: plan === 'annual' ? p.pricePerMonthString : null,
        trialDays: plan === 'lifetime' || !mayTry ? null : trialDays(p),
      }
    }),
  )
}

/** A switch in the current offering's metadata (RevenueCat dashboard), off
 *  unless set to true there: lets an offer be tried without a new build. */
export const offeringFlag = (key: string) => offeringSwitch(key, false)

/** A switch in the current offering's metadata, as set there; `fallback`
 *  when it is not set, or the store cannot be reached. */
export async function offeringSwitch(key: string, fallback: boolean): Promise<boolean> {
  if (!(await initPurchases())) return fallback
  const { current } = await Purchases.getOfferings().catch(() => ({ current: null }))
  const v = current?.metadata?.[key]
  return typeof v === 'boolean' ? v : fallback
}

/** 'cancelled' when the player closed the store's sheet. */
export async function buy(pkg: PurchasesPackage): Promise<'done' | 'cancelled'> {
  try {
    apply((await Purchases.purchasePackage({ aPackage: pkg })).customerInfo)
    return 'done'
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return 'cancelled'
    throw e
  }
}

/** Asks the store for past purchases (new phone, reinstall). True if Pro. */
export async function restore(): Promise<boolean> {
  if (!(await initPurchases())) return false
  const { customerInfo } = await Purchases.restorePurchases()
  apply(customerInfo)
  return licenseFrom(customerInfo)?.status === 'active'
}

/** The store's own page to change plan or cancel. */
export async function manageUrl(): Promise<string | null> {
  if (!(await initPurchases())) return null
  return (await Purchases.getCustomerInfo()).customerInfo.managementURL
}
