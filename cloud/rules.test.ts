import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { env } from './env'

/**
 * The database rules, against a local Supabase (`npx supabase start`).
 * Run with `npm run test:cloud`.
 */
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } })

const stamp = Date.now()
const made: string[] = []

async function user(name: string): Promise<{ id: string; email: string; db: SupabaseClient }> {
  const email = `${name}-${stamp}@example.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'test-password-1', email_confirm: true })
  if (error) throw error
  made.push(data.user.id)
  const db = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
  const signIn = await db.auth.signInWithPassword({ email, password: 'test-password-1' })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, email, db }
}

const item = (id: string, at: number, data: object = { name: id }) => ({ kind: 'setup', id, data, deleted: false, client_updated_at: at })

let free: Awaited<ReturnType<typeof user>>
let pro: Awaited<ReturnType<typeof user>>

beforeAll(async () => {
  free = await user('free')
  pro = await user('pro')
  const { error } = await admin.from('subscriptions').insert({ email: pro.email, status: 'active' })
  if (error) throw error
})

afterAll(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id)
  await admin.from('subscriptions').delete().like('email', `%-${stamp}@example.test`)
})

describe('sync needs Pro', () => {
  it('a free account cannot sync', async () => {
    const { error } = await free.db.from('items').upsert(item('s1', 1))
    expect(error?.code).toBe('42501')
  })

  it('a Pro account syncs, and reads only its own items', async () => {
    expect((await pro.db.from('items').upsert(item('s1', 10))).error).toBeNull()
    const own = await pro.db.from('items').select('id')
    expect(own.data).toEqual([{ id: 's1' }])
    const other = await free.db.from('items').select('id')
    expect(other.data).toEqual([])
    const nobody = await anon.from('items').select('id')
    expect(nobody.data).toEqual([])
  })

  it('an older copy never overwrites a newer one', async () => {
    await pro.db.from('items').upsert(item('s2', 100, { v: 'new' }))
    await pro.db.from('items').upsert(item('s2', 50, { v: 'old' }))
    const { data } = await pro.db.from('items').select('data').eq('id', 's2').single()
    expect(data?.data).toEqual({ v: 'new' })
  })

  it('a cancelled subscription keeps Pro until the paid period ends', async () => {
    const c = await user('cancelled')
    await admin.from('subscriptions').insert({ email: c.email, status: 'cancelled', ends_at: new Date(Date.now() + 86_400_000).toISOString() })
    expect((await c.db.from('items').upsert(item('x', 1))).error).toBeNull()
    await admin.from('subscriptions').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('email', c.email)
    expect((await c.db.from('items').upsert(item('y', 1))).error?.code).toBe('42501')
  })

  it('a subscription linked by user id works with any email', async () => {
    const u = await user('linked')
    await admin.from('subscriptions').insert({ email: `paid-elsewhere-${stamp}@example.test`, user_id: u.id, status: 'on_trial' })
    expect((await u.db.from('items').upsert(item('z', 1))).error).toBeNull()
    const sub = await u.db.from('subscriptions').select('status').single()
    expect(sub.data?.status).toBe('on_trial')
  })

  it('players cannot grant themselves Pro', async () => {
    const { error } = await free.db.from('subscriptions').insert({ email: free.email, status: 'active' })
    expect(error).not.toBeNull()
  })
})

describe('community measurements', () => {
  const rid = `stock-test-frame-${stamp}`
  it('rows are private; medians appear from 3 frames up', async () => {
    const a = await user('m1')
    const b = await user('m2')
    const c = await user('m3')
    expect((await a.db.from('measurements').insert({ racket_id: rid, strung: true, weight_g: 320, swingweight: 325 })).error).toBeNull()
    await b.db.from('measurements').insert({ racket_id: rid, strung: true, weight_g: 322 })
    let stats = await anon.from('measurement_stats').select('*').eq('racket_id', rid)
    expect(stats.data).toEqual([])
    await c.db.from('measurements').insert({ racket_id: rid, strung: true, weight_g: 330, balance_cm: 32.5 })
    stats = await anon.from('measurement_stats').select('*').eq('racket_id', rid)
    expect(stats.data).toHaveLength(1)
    expect(stats.data![0]).toMatchObject({ n: 3, weight_g: 322, swingweight_n: 1, balance_n: 1 })
    expect((await anon.from('measurements').select('*')).data).toEqual([])
    expect((await b.db.from('measurements').select('weight_g')).data).toEqual([{ weight_g: 322 }])
  })

  it('rejects implausible numbers and custom frames', async () => {
    const a = await user('m4')
    expect((await a.db.from('measurements').insert({ racket_id: rid, strung: true, weight_g: 999 })).error).not.toBeNull()
    expect((await a.db.from('measurements').insert({ racket_id: 'my-own', strung: true, weight_g: 300 })).error).not.toBeNull()
  })
})

describe('public setups', () => {
  const setup = { racket_id: 'stock-x', name: 'Mais plow', config: { leadG: { tip: 2 } }, specs: { weightG: 330 } }

  it('anyone reads; publishing needs an account', async () => {
    expect((await anon.from('public_setups').insert(setup)).error).not.toBeNull()
    const { data, error } = await free.db.from('public_setups').insert(setup).select('id').single()
    expect(error).toBeNull()
    const seen = await anon.from('public_setups').select('name, copies').eq('id', data!.id).single()
    expect(seen.data).toEqual({ name: 'Mais plow', copies: 0 })
    await anon.rpc('count_copy', { setup_id: data!.id })
    expect((await anon.from('public_setups').select('copies').eq('id', data!.id).single()).data?.copies).toBe(1)
  })

  it('cannot fake copies or publish as someone else', async () => {
    expect((await free.db.from('public_setups').insert({ ...setup, copies: 500 })).error).not.toBeNull()
    expect((await free.db.from('public_setups').insert({ ...setup, user_id: pro.id })).error).not.toBeNull()
  })

  it('three reports hide a setup', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'Spam' }).select('id').single()
    for (const n of ['r1', 'r2', 'r3']) {
      const r = await user(n)
      expect((await r.db.from('reports').insert({ setup_id: data!.id })).error).toBeNull()
    }
    expect((await anon.from('public_setups').select('id').eq('id', data!.id)).data).toEqual([])
    // The author still sees it.
    expect((await free.db.from('public_setups').select('hidden').eq('id', data!.id).single()).data?.hidden).toBe(true)
  })
})

describe('account deletion', () => {
  it('removes the account and its data', async () => {
    const u = await user('leaving')
    await admin.from('subscriptions').insert({ email: u.email, status: 'active' })
    await u.db.from('items').upsert(item('gone', 1))
    await u.db.from('measurements').insert({ racket_id: 'stock-gone', strung: false, weight_g: 300 })
    expect((await u.db.rpc('delete_account')).error).toBeNull()
    const left = await admin.from('items').select('id').eq('user_id', u.id)
    expect(left.data).toEqual([])
    const m = await admin.from('measurements').select('id').eq('user_id', u.id)
    expect(m.data).toEqual([])
    expect((await admin.auth.admin.getUserById(u.id)).data.user).toBeNull()
  })
})
