import { describe, expect, it } from 'vitest'
import { handle, type StoreSubscriptionRow, type Subscriber } from '../../supabase/functions/rc-webhook/handler'

// The webhook's logic with an in-memory table; cloud/rc-webhook.test.ts runs
// the same against a local Supabase, has_pro included.
const NOW = Date.parse('2026-10-12T00:00:00Z')
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function setup() {
  const table = new Map<string, StoreSubscriptionRow>()
  const subscribers: Record<string, Subscriber> = {}
  const asked: string[] = []
  const deps = {
    auth: 'Bearer s3cret',
    now: () => NOW,
    subscriber: async (id: string) => (asked.push(id), subscribers[id] ?? null),
    upsert: async (r: StoreSubscriptionRow) => void table.set(r.user_id, r),
    remove: async (id: string) => void table.delete(id),
  }
  const send = (event: object, auth: string | null = 'Bearer s3cret') => handle(JSON.stringify({ event }), auth, deps)
  return { table, subscribers, asked, send }
}

const sub = (over: object = {}, expires: string | null = '2026-11-12T00:00:00Z'): Subscriber => ({
  entitlements: { pro: { expires_date: expires, product_identifier: 'pro_monthly' } },
  subscriptions: { pro_monthly: { store: 'play_store', period_type: 'normal', is_sandbox: false, ...over } },
})

describe('RevenueCat webhook', () => {
  it('refuses a missing or wrong Authorization header', async () => {
    const { send, asked } = setup()
    expect((await send({ type: 'RENEWAL', app_user_id: A }, null)).status).toBe(401)
    expect((await send({ type: 'RENEWAL', app_user_id: A }, 'Bearer s3cres')).status).toBe(401)
    expect(asked).toEqual([])
  })

  it('reads the state fresh: trial, active, cancelled, billing issue, expired', async () => {
    const { send, subscribers, table } = setup()
    const status = async (s: Subscriber) => {
      subscribers[A] = s
      await send({ type: 'RENEWAL', app_user_id: A })
      return table.get(A)?.status
    }
    expect(await status(sub({ period_type: 'trial' }))).toBe('on_trial')
    expect(await status(sub())).toBe('active')
    expect(await status(sub({ unsubscribe_detected_at: '2026-10-20T00:00:00Z' }))).toBe('cancelled')
    expect(await status(sub({ billing_issues_detected_at: '2026-10-20T00:00:00Z' }))).toBe('past_due')
    expect(await status(sub({}, '2026-10-01T00:00:00Z'))).toBe('expired')
    expect(await status(sub({}, null))).toBe('active')
    expect(table.get(A)).toMatchObject({ store: 'play_store', product_id: 'pro_monthly', ends_at: null })
  })

  it('Google Play base plans: "product:plan" keys still match', async () => {
    const { send, subscribers, table } = setup()
    subscribers[A] = { entitlements: { pro: { expires_date: '2026-11-12T00:00:00Z', product_identifier: 'pro' } }, subscriptions: { 'pro:monthly': { store: 'play_store', period_type: 'trial' } } }
    await send({ type: 'INITIAL_PURCHASE', app_user_id: A })
    expect(table.get(A)?.status).toBe('on_trial')
  })

  it('a transfer updates both accounts', async () => {
    const { send, subscribers, table } = setup()
    subscribers[A] = sub()
    await send({ type: 'RENEWAL', app_user_id: A })
    subscribers[A] = { entitlements: {} }
    subscribers[B] = sub()
    await send({ type: 'TRANSFER', transferred_from: [A], transferred_to: [B] })
    expect(table.has(A)).toBe(false)
    expect(table.get(B)?.status).toBe('active')
  })

  it('anonymous ids, test events and junk change nothing', async () => {
    const { send, asked } = setup()
    expect((await send({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc', aliases: ["x' or 1=1"] })).body).toBe('anonymous')
    expect((await send({ type: 'TEST' })).body).toBe('test')
    expect((await handle('{', 'Bearer s3cret', { auth: 'Bearer s3cret', subscriber: async () => null, upsert: async () => {}, remove: async () => {} })).status).toBe(400)
    expect(asked).toEqual([])
  })
})
