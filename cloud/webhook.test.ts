import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, it } from 'vitest'
import { handle, sign, subscriptionUpsert } from '../supabase/functions/ls-webhook/handler'
import { env } from './env'

const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const SECRET = 'whsec-test'
const stamp = Date.now()
const email = `Buyer-${stamp}@Example.test`
const deps = { secret: SECRET, storeId: '42', upsert: subscriptionUpsert(admin) }

const event = (name: string, attributes: object, custom?: object) =>
  JSON.stringify({ meta: { event_name: name, custom_data: custom }, data: { type: 'subscriptions', id: '9001', attributes: { store_id: 42, user_email: email, ...attributes } } })

async function send(body: string, signature?: string | null) {
  return handle(body, signature === undefined ? await sign(SECRET, body) : signature, deps)
}
const row = async () => (await admin.from('subscriptions').select('*').eq('email', email.toLowerCase()).single()).data

afterAll(async () => {
  await admin.from('subscriptions').delete().eq('email', email.toLowerCase())
})

describe('Lemon Squeezy webhook', () => {
  it('refuses a missing or wrong signature', async () => {
    const body = event('subscription_created', { status: 'on_trial' })
    expect((await send(body, null)).status).toBe(401)
    expect((await send(body, 'ab'.repeat(32))).status).toBe(401)
    expect(await row()).toBeNull()
  })

  it('creates the subscription with the account link', async () => {
    const { data } = await admin.auth.admin.createUser({ email: `acct-${stamp}@example.test`, email_confirm: true })
    const uid = data.user!.id
    const r = await send(event('subscription_created', { status: 'on_trial', renews_at: '2026-10-16T00:00:00Z' }, { user_id: uid }))
    expect(r).toEqual({ status: 200, body: 'ok' })
    expect(await row()).toMatchObject({ status: 'on_trial', user_id: uid, ls_subscription_id: '9001' })
    // A later event without custom data keeps the link.
    await send(event('subscription_updated', { status: 'active' }))
    expect(await row()).toMatchObject({ status: 'active', user_id: uid })
    // Cancelled: Pro to the end of the period, then expired.
    await send(event('subscription_cancelled', { status: 'cancelled', ends_at: '2026-11-16T00:00:00Z' }))
    expect(await row()).toMatchObject({ status: 'cancelled', ends_at: '2026-11-16T00:00:00+00:00' })
    await send(event('subscription_expired', { status: 'expired' }))
    expect((await row())?.status).toBe('expired')
    await admin.auth.admin.deleteUser(uid)
  })

  it('ignores other stores and other events', async () => {
    const other = JSON.stringify({ meta: { event_name: 'subscription_created' }, data: { type: 'subscriptions', id: '1', attributes: { store_id: 7, user_email: email, status: 'active' } } })
    expect((await send(other)).body).toBe('other store')
    const order = JSON.stringify({ meta: { event_name: 'order_created' }, data: { type: 'orders', id: '1', attributes: {} } })
    expect((await send(order)).body).toBe('ignored')
  })

  it('a bad user id in custom data is dropped, not trusted', async () => {
    await send(event('subscription_updated', { status: 'active' }, { user_id: "x' or 1=1" }))
    expect((await row())?.status).toBe('active')
  })
})
