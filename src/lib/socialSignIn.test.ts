import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The IDs are read once, when the module loads.
async function load(ids: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(ids)) vi.stubEnv(k, v)
  return import('./socialSignIn')
}

afterEach(() => vi.unstubAllEnvs())

describe('sign in with Apple and Google', () => {
  it('hands Apple and Google the SHA-256 of the nonce Supabase gets', async () => {
    const { newNonce } = await load({})
    const a = await newNonce()
    const b = await newNonce()
    expect(a.raw).toMatch(/^[0-9a-f]{32}$/)
    expect(a.hashed).toBe(createHash('sha256').update(a.raw).digest('hex'))
    expect(b.raw).not.toBe(a.raw)
  })

  it('shows a button only for what the build has IDs for (a browser here)', async () => {
    expect((await load({})).providers()).toEqual({ apple: false, google: false })
    expect((await load({ VITE_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' })).providers()).toEqual({ apple: false, google: true })
    expect((await load({ VITE_APPLE_SERVICE_ID: 'app.swingmath.web', VITE_GOOGLE_WEB_CLIENT_ID: ' ' })).providers()).toEqual({ apple: true, google: false })
  })

  it('offers the email code only when switched on, or when there is no other way in', async () => {
    const google = { VITE_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' }
    expect((await load({})).emailSignIn()).toBe(true)
    expect((await load(google)).emailSignIn()).toBe(false)
    expect((await load({ ...google, VITE_EMAIL_SIGN_IN: 'true' })).emailSignIn()).toBe(true)
  })
})
