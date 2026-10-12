import { Capacitor } from '@capacitor/core'
import { LOG_LEVEL, Purchases, type CustomerInfo, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { useStore } from '../data/store'
import type { Plan } from './entitlement'
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
  trialDays: number | null
}

/** The plans of the current offering, with the store's own prices. */
export async function storePlans(): Promise<StorePlan[]> {
  if (!(await initPurchases())) return []
  const { current } = await Purchases.getOfferings()
  const out: StorePlan[] = []
  for (const [plan, pkg] of [['monthly', current?.monthly], ['annual', current?.annual]] as const)
    if (pkg) out.push({ plan, pkg, price: pkg.product.priceString, trialDays: trialDays(pkg.product) })
  return out
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
