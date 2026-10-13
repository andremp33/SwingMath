import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import type { StorePlan } from './purchases'

/**
 * Development only (`VITE_FAKE_STORE=true` with the dev server): plans as a
 * store would send them, so the app's paywall can be seen and tested in a
 * browser, where there is no App Store or Google Play. Never in a build.
 */
export function fakePlans(): StorePlan[] {
  const pkg = (id: string) => ({ identifier: id, product: { identifier: id } }) as unknown as PurchasesPackage
  return [
    { plan: 'annual', pkg: pkg('$rc_annual'), price: '29,99 €', amount: 29.99, pricePerMonth: '2,50 €', trialDays: 7 },
    { plan: 'lifetime', pkg: pkg('$rc_lifetime'), price: '49,99 €', amount: 49.99, pricePerMonth: null, trialDays: null },
    { plan: 'monthly', pkg: pkg('$rc_monthly'), price: '3,99 €', amount: 3.99, pricePerMonth: null, trialDays: null },
  ]
}
