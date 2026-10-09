import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { License } from '../data/store'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 9)

async function load() {
  vi.resetModules()
  vi.stubEnv('VITE_LS_STORE_ID', '42')
  vi.stubEnv('VITE_LS_CHECKOUT_MONTHLY', 'https://example.test/m')
  return import('./entitlement')
}

const reply = (status: number, body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

const lic = (checkedDaysAgo: number): License => ({
  provider: 'lemonsqueezy',
  key: 'KEY',
  instanceId: 'inst',
  activatedAt: NOW - 40 * DAY,
  checkedAt: NOW - checkedDaysAgo * DAY,
  status: 'active',
})

describe('subscription license', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllEnvs())

  it('activates a key from our store', async () => {
    const m = await load()
    vi.stubGlobal('fetch', reply(200, { activated: true, instance: { id: 'i1' }, meta: { store_id: 42 }, license_key: { expires_at: '2026-11-09' } }))
    const l = await m.activateLicense(' KEY ', NOW)
    expect(l).toMatchObject({ key: 'KEY', instanceId: 'i1', status: 'active', checkedAt: NOW, expiresAt: '2026-11-09' })
  })

  it('refuses a key from another store', async () => {
    const m = await load()
    vi.stubGlobal('fetch', reply(200, { activated: true, instance: { id: 'i1' }, meta: { store_id: 7 } }))
    await expect(m.activateLicense('KEY', NOW)).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('checks again only after a few days', async () => {
    const m = await load()
    expect(m.needsCheck(lic(1), NOW)).toBe(false)
    expect(m.needsCheck(lic(4), NOW)).toBe(true)
    expect(m.needsCheck({ provider: 'dev', activatedAt: 0 }, NOW)).toBe(false)
  })

  it('switches Pro off when the subscription has ended, and keeps the key', async () => {
    const m = await load()
    vi.stubGlobal('fetch', reply(200, { valid: false, meta: { store_id: 42 }, license_key: { status: 'disabled' } }))
    const l = await m.revalidate(lic(4), NOW)
    expect(l.status).toBe('ended')
    expect(l.key).toBe('KEY')
  })

  it('a renewed subscription brings Pro back', async () => {
    const m = await load()
    vi.stubGlobal('fetch', reply(200, { valid: true, meta: { store_id: 42 } }))
    expect((await m.revalidate({ ...lic(4), status: 'ended' }, NOW)).status).toBe('active')
  })

  it('offline: keeps Pro during the grace period, then asks to connect', async () => {
    const m = await load()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    expect((await m.revalidate(lic(10), NOW)).status).toBe('active')
    expect((await m.revalidate(lic(31), NOW)).status).toBe('offline')
  })

  it('a server error counts as offline, not as an ended subscription', async () => {
    const m = await load()
    vi.stubGlobal('fetch', reply(503, {}))
    expect((await m.revalidate(lic(4), NOW)).status).toBe('active')
  })

  it('annual saving against 12 months', async () => {
    const m = await load()
    expect(m.annualSaving()).toBe(37)
  })
})
