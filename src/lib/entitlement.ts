import type { License } from '../data/store'

/**
 * Pro unlock.
 * Web: a one-time Lemon Squeezy product with license keys. Activation calls
 * Lemon Squeezy's public License API from the browser (no secret needed),
 * once; after that the app works offline.
 * Android/iOS: store purchases through RevenueCat, wired in the Capacitor
 * build (see replica/backend.md).
 */
export const CHECKOUT_URL = import.meta.env.VITE_LS_CHECKOUT_URL as string | undefined
const STORE_ID = import.meta.env.VITE_LS_STORE_ID as string | undefined

export const storeConfigured = () => Boolean(CHECKOUT_URL && STORE_ID)

export class LicenseError extends Error {
  kind: 'invalid' | 'offline' | 'config'
  constructor(kind: 'invalid' | 'offline' | 'config') {
    super(kind)
    this.kind = kind
  }
}

export async function activateLicense(key: string): Promise<License> {
  if (!storeConfigured()) throw new LicenseError('config')
  let res: Response
  try {
    res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ license_key: key.trim(), instance_name: deviceName() }),
    })
  } catch {
    throw new LicenseError('offline')
  }
  const data = (await res.json().catch(() => ({}))) as {
    activated?: boolean
    instance?: { id: string }
    meta?: { store_id?: number }
  }
  // The store id check stops keys from other Lemon Squeezy stores working here.
  if (!res.ok || !data.activated || String(data.meta?.store_id) !== String(STORE_ID) || !data.instance) {
    throw new LicenseError('invalid')
  }
  return { provider: 'lemonsqueezy', key: key.trim(), instanceId: data.instance.id, activatedAt: Date.now() }
}

export async function deactivateLicense(l: License): Promise<void> {
  if (l.provider !== 'lemonsqueezy' || !l.key || !l.instanceId) return
  try {
    await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ license_key: l.key, instance_id: l.instanceId }),
    })
  } catch {
    // Offline: the seat stays used; the user can free it from their receipt email.
  }
}

function deviceName() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Web'
  return `SwingMath ${os} ${new Date().toISOString().slice(0, 10)}`
}
