import type { License } from '../data/store'

/**
 * Pro is a subscription, monthly or annual, with a free trial.
 * Web: a Lemon Squeezy subscription product with license keys. The key is
 * activated once from the browser (public License API, no secret), then
 * checked again every few days: when the subscription ends Lemon Squeezy
 * disables the key and Pro switches off. Offline, Pro keeps working for a
 * grace period.
 * Android/iOS: store subscriptions through RevenueCat, wired in the Capacitor
 * build (see replica/backend.md).
 */
export type Plan = 'monthly' | 'annual'
export const PLANS: Plan[] = ['monthly', 'annual']

const env = import.meta.env
export const CHECKOUT: Record<Plan, string | undefined> = {
  monthly: (env.VITE_LS_CHECKOUT_MONTHLY as string | undefined) || undefined,
  annual: (env.VITE_LS_CHECKOUT_ANNUAL as string | undefined) || undefined,
}
/** Lemon Squeezy's customer portal, where subscribers change plan or cancel. */
export const PORTAL_URL = (env.VITE_LS_PORTAL_URL as string | undefined) || undefined
const STORE_ID = env.VITE_LS_STORE_ID as string | undefined

/** Shown in the app; the real prices are set in the store. Keep them equal. */
export const PRICING = {
  monthly: Number(env.VITE_PRICE_MONTHLY || 3.99),
  annual: Number(env.VITE_PRICE_ANNUAL || 29.99),
  currency: (env.VITE_PRICE_CURRENCY as string | undefined) || 'EUR',
  trialDays: Number(env.VITE_TRIAL_DAYS || 7),
}
/** How much the annual plan saves against 12 months, in %. */
export const annualSaving = () => Math.round((1 - PRICING.annual / (12 * PRICING.monthly)) * 100)

export const storeConfigured = () => Boolean(STORE_ID && (CHECKOUT.monthly || CHECKOUT.annual))

export const REVALIDATE_MS = 3 * 86_400_000
export const OFFLINE_GRACE_MS = 30 * 86_400_000

export class LicenseError extends Error {
  kind: 'invalid' | 'offline' | 'config'
  constructor(kind: 'invalid' | 'offline' | 'config') {
    super(kind)
    this.kind = kind
  }
}

interface LsResponse {
  activated?: boolean
  valid?: boolean
  instance?: { id: string }
  license_key?: { status?: string; expires_at?: string | null }
  meta?: { store_id?: number }
}

async function post(path: string, body: Record<string, string>): Promise<{ res: Response; data: LsResponse }> {
  let res: Response
  try {
    res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
  } catch {
    throw new LicenseError('offline')
  }
  if (res.status >= 500) throw new LicenseError('offline')
  return { res, data: (await res.json().catch(() => ({}))) as LsResponse }
}

// The store id check stops keys from other Lemon Squeezy stores working here.
const ourStore = (d: LsResponse) => String(d.meta?.store_id) === String(STORE_ID)

export async function activateLicense(key: string, now = Date.now()): Promise<License> {
  if (!storeConfigured()) throw new LicenseError('config')
  const { res, data } = await post('activate', { license_key: key.trim(), instance_name: deviceName() })
  if (!res.ok || !data.activated || !ourStore(data) || !data.instance) throw new LicenseError('invalid')
  return {
    provider: 'lemonsqueezy',
    key: key.trim(),
    instanceId: data.instance.id,
    activatedAt: now,
    checkedAt: now,
    status: 'active',
    expiresAt: data.license_key?.expires_at ?? null,
  }
}

/**
 * Checks a key again. Returns the updated license: status 'ended' once the
 * subscription has ended (the key is kept, so renewing brings Pro back),
 * 'active' while it runs. Offline it changes nothing until the grace period
 * is over.
 */
export async function revalidate(l: License, now = Date.now()): Promise<License> {
  if (l.provider !== 'lemonsqueezy' || !l.key || !l.instanceId) return l
  try {
    const { res, data } = await post('validate', { license_key: l.key, instance_id: l.instanceId })
    const active = res.ok && data.valid === true && ourStore(data)
    return { ...l, checkedAt: now, status: active ? 'active' : 'ended', expiresAt: data.license_key?.expires_at ?? l.expiresAt ?? null }
  } catch (e) {
    if (!(e instanceof LicenseError) || e.kind !== 'offline') throw e
    const last = l.checkedAt ?? l.activatedAt
    return now - last > OFFLINE_GRACE_MS ? { ...l, status: 'offline' } : l
  }
}

export const needsCheck = (l: License | null, now = Date.now()) =>
  l?.provider === 'lemonsqueezy' && now - (l.checkedAt ?? l.activatedAt) > REVALIDATE_MS

export async function deactivateLicense(l: License): Promise<void> {
  if (l.provider !== 'lemonsqueezy' || !l.key || !l.instanceId) return
  try {
    await post('deactivate', { license_key: l.key, instance_id: l.instanceId })
  } catch {
    // Offline: the seat stays used; the user can free it from their receipt email.
  }
}

function deviceName() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Web'
  return `SwingMath ${os} ${new Date().toISOString().slice(0, 10)}`
}
