import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handle, type Subscriber } from '../supabase/functions/rc-webhook/handler'
import { env } from './env'

const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const AUTH = 'Bearer rc-test'
const stamp = Date.now()
const NOW = Date.parse('2026-10-12T00:00:00Z')

let uid = ''
let other = ''
// What RevenueCat's REST API answers, per app user id.
const subscribers: Record<string, Subscriber | null> = {}
const deps = {
  auth: AUTH,
  now: () => NOW,
  subscriber: async (id: string) => subscribers[id] ?? null,
  upsert: async (row: object) => {
    const { error } = await admin.from('store_subscriptions').upsert(row)
    if (error) throw error
  },
  remove: async (id: string) => {
    await admin.from('store_subscriptions').delete().eq('user_id', id)
  },
}
const send = (event: object, auth: string | null = AUTH) => handle(JSON.stringify({ event }), auth, deps)
const row = async (id = uid) => (await admin.from('store_subscriptions').select('*').eq('user_id', id).maybeSingle()).data
const hasPro = async (id: string) => (await admin.rpc('has_pro', { uid: id })).data as boolean
const sub = (over: object = {}, expires = '2099-11-12T00:00:00Z'): Subscriber => ({
  entitlements: { pro: { expires_date: expires, product_identifier: 'swingmath_pro_monthly' } },
  subscriptions: {
    swingmath_pro_monthly: { store: 'app_store', period_type: 'normal', unsubscribe_detected_at: null, billing_issues_detected_at: null, is_sandbox: true, ...over },
  },
})

beforeAll(async () => {
  // Pro beta off for these checks, back on afterwards.
  await admin.from('app_flags').update({ enabled: false }).eq('name', 'pro_beta')
  const a = await admin.auth.admin.createUser({ email: `rc-buyer-${stamp}@example.test`, email_confirm: true })
  const b = await admin.auth.admin.createUser({ email: `rc-other-${stamp}@example.test`, email_confirm: true })
  uid = a.data.user!.id
  other = b.data.user!.id
})
afterAll(async () => {
  await admin.auth.admin.deleteUser(uid)
  await admin.auth.admin.deleteUser(other)
  await admin.from('app_flags').update({ enabled: true }).eq('name', 'pro_beta')
})

describe('RevenueCat webhook', () => {
  it('refuses a missing or wrong Authorization header', async () => {
    expect((await send({ type: 'INITIAL_PURCHASE', app_user_id: uid }, null)).status).toBe(401)
    expect((await send({ type: 'INITIAL_PURCHASE', app_user_id: uid }, 'Bearer nope')).status).toBe(401)
    expect(await row()).toBeNull()
  })

  it('a purchase gives the account Pro; cancelling keeps it to the end of the period', async () => {
    subscribers[uid] = sub({ period_type: 'trial' })
    expect(await send({ type: 'INITIAL_PURCHASE', app_user_id: uid })).toEqual({ status: 200, body: 'ok' })
    expect(await row()).toMatchObject({ status: 'on_trial', store: 'app_store', sandbox: true })
    expect(await hasPro(uid)).toBe(true)

    subscribers[uid] = sub({ unsubscribe_detected_at: '2026-10-20T00:00:00Z' })
    await send({ type: 'CANCELLATION', app_user_id: uid })
    expect(await row()).toMatchObject({ status: 'cancelled' })
    expect(await hasPro(uid)).toBe(true)

    subscribers[uid] = sub({}, '2026-10-01T00:00:00Z')
    await send({ type: 'EXPIRATION', app_user_id: uid })
    expect(await row()).toMatchObject({ status: 'expired' })
    expect(await hasPro(uid)).toBe(false)
  })

  it('a transfer moves Pro to the other account', async () => {
    subscribers[uid] = sub()
    await send({ type: 'RENEWAL', app_user_id: uid })
    subscribers[uid] = { entitlements: {}, subscriptions: {} }
    subscribers[other] = sub()
    await send({ type: 'TRANSFER', transferred_from: [uid], transferred_to: [other] })
    expect(await row()).toBeNull()
    expect(await row(other)).toMatchObject({ status: 'active' })
    expect(await hasPro(other)).toBe(true)
  })

  it('anonymous ids and test events change nothing', async () => {
    expect((await send({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' })).body).toBe('anonymous')
    expect((await send({ type: 'TEST', app_user_id: 'x' })).body).toBe('test')
  })

  it('nobody else can read the rows', async () => {
    const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
    expect((await anon.from('store_subscriptions').select('*')).data).toEqual([])
  })
})
