/**
 * Pro is sold in the store apps only: a monthly or annual subscription (7
 * days free on the annual plan) or a lifetime purchase, through the App
 * Store and Google Play via RevenueCat (see purchases.ts and storeBilling.ts).
 * An account's Pro comes from the store_subscriptions table, which
 * RevenueCat's webhook keeps.
 */

/** While in beta, every Pro feature is free for everyone. Off unless a
 *  build asks for it with VITE_PRO_BETA=true, so a store build sells Pro. */
export const PRO_BETA = (import.meta.env.VITE_PRO_BETA as string | undefined) === 'true'

export type Plan = 'monthly' | 'annual' | 'lifetime'
