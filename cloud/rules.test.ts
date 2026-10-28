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
  // These rules are about selling Pro; the beta switch is tested on its own.
  await admin.from('app_flags').update({ enabled: false }).eq('name', 'pro_beta')
  free = await user('free')
  pro = await user('pro')
  const { error } = await admin.from('subscriptions').insert({ email: pro.email, status: 'active' })
  if (error) throw error
})

afterAll(async () => {
  await admin.from('app_flags').update({ enabled: true }).eq('name', 'pro_beta')
  for (const id of made) await admin.auth.admin.deleteUser(id)
  await admin.from('subscriptions').delete().like('email', `%-${stamp}@example.test`)
})

const hasPro = async (u: { id: string; db: SupabaseClient }) => (await u.db.rpc('has_pro', { uid: u.id })).data as boolean

describe('sync is free with any account', () => {
  it('a free account syncs, and reads only its own items', async () => {
    expect((await free.db.from('items').upsert(item('s1', 10))).error).toBeNull()
    expect((await free.db.from('items').select('id')).data).toEqual([{ id: 's1' }])
    expect((await pro.db.from('items').select('id')).data).toEqual([])
    expect((await anon.from('items').select('id')).data).toEqual([])
  })

  it('nobody writes items as someone else', async () => {
    const { error } = await free.db.from('items').upsert({ ...item('theirs', 1), user_id: pro.id })
    expect(error?.code).toBe('42501')
  })

  it('an older copy never overwrites a newer one', async () => {
    await free.db.from('items').upsert(item('s2', 100, { v: 'new' }))
    await free.db.from('items').upsert(item('s2', 50, { v: 'old' }))
    const { data } = await free.db.from('items').select('data').eq('id', 's2').single()
    expect(data?.data).toEqual({ v: 'new' })
  })
})

describe('Pro through the account', () => {
  it('a subscription gives Pro; an account without one has none', async () => {
    expect(await hasPro(pro)).toBe(true)
    expect(await hasPro(free)).toBe(false)
  })

  it('a cancelled subscription keeps Pro until the paid period ends', async () => {
    const c = await user('cancelled')
    await admin.from('subscriptions').insert({ email: c.email, status: 'cancelled', ends_at: new Date(Date.now() + 86_400_000).toISOString() })
    expect(await hasPro(c)).toBe(true)
    await admin.from('subscriptions').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('email', c.email)
    expect(await hasPro(c)).toBe(false)
  })

  it('a subscription linked by user id works with any email', async () => {
    const u = await user('linked')
    await admin.from('subscriptions').insert({ email: `paid-elsewhere-${stamp}@example.test`, user_id: u.id, status: 'on_trial' })
    expect(await hasPro(u)).toBe(true)
    const sub = await u.db.from('subscriptions').select('status').single()
    expect(sub.data?.status).toBe('on_trial')
  })

  it('players cannot grant themselves Pro', async () => {
    const { error } = await free.db.from('subscriptions').insert({ email: free.email, status: 'active' })
    expect(error).not.toBeNull()
  })
})

describe('Pro beta', () => {
  it('with the beta switch on, a free account has Pro', async () => {
    await admin.from('app_flags').update({ enabled: true }).eq('name', 'pro_beta')
    try {
      expect(await hasPro(free)).toBe(true)
    } finally {
      await admin.from('app_flags').update({ enabled: false }).eq('name', 'pro_beta')
    }
  })

  it('players cannot flip the switch', async () => {
    await free.db.from('app_flags').update({ enabled: true }).eq('name', 'pro_beta')
    const { data } = await admin.from('app_flags').select('enabled').eq('name', 'pro_beta').single()
    expect(data?.enabled).toBe(false)
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
    const seen = await anon.from('community_setups').select('name, copies').eq('id', data!.id).single()
    expect(seen.data).toEqual({ name: 'Mais plow', copies: 0 })
    await anon.rpc('count_copy', { setup_id: data!.id })
    expect((await anon.from('community_setups').select('copies').eq('id', data!.id).single()).data?.copies).toBe(1)
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
    expect((await anon.from('community_setups').select('id').eq('id', data!.id)).data).toEqual([])
    // The author still sees it, and that it is hidden.
    expect((await free.db.from('community_setups').select('hidden, mine').eq('id', data!.id).single()).data).toEqual({ hidden: true, mine: true })
  })

  it('a copy counts once per player; without an account, at most 20 a day', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'Contada' }).select('id').single()
    const copies = async () => (await anon.from('community_setups').select('copies').eq('id', data!.id).single()).data?.copies
    const p = await user('c1')
    await p.db.rpc('count_copy', { setup_id: data!.id })
    await p.db.rpc('count_copy', { setup_id: data!.id })
    expect(await copies()).toBe(1)
    for (let i = 0; i < 25; i++) await anon.rpc('count_copy', { setup_id: data!.id })
    expect(await copies()).toBe(21)
  })

  it('a setup many copied needs reports from a tenth of them, not three', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'Popular' }).select('id').single()
    await admin.from('public_setups').update({ copies: 50 }).eq('id', data!.id)
    for (const n of ['p1', 'p2', 'p3']) await (await user(n)).db.from('reports').insert({ setup_id: data!.id })
    expect((await anon.from('community_setups').select('id').eq('id', data!.id)).data).toHaveLength(1)
    for (const n of ['p4', 'p5']) await (await user(n)).db.from('reports').insert({ setup_id: data!.id })
    expect((await anon.from('community_setups').select('id').eq('id', data!.id)).data).toEqual([])
    // Only the service role sees the queue.
    expect((await anon.from('moderation_queue').select('id')).data ?? []).toEqual([])
    expect((await admin.from('moderation_queue').select('reports').eq('id', data!.id).single()).data?.reports).toBe(5)
  })
})

describe('who wrote a recipe', () => {
  const setup = { racket_id: 'stock-x', name: 'De quem', config: { leadG: { tip: 2 } }, specs: { weightG: 330 } }

  it('the table is read only by its author; everyone else reads the view', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, setup_ref: 'mine-only' }).select('id').single()
    expect((await anon.from('public_setups').select('id').eq('id', data!.id)).data ?? []).toEqual([])
    expect((await pro.db.from('public_setups').select('id').eq('id', data!.id)).data).toEqual([])
    expect((await free.db.from('public_setups').select('id').eq('id', data!.id)).data).toHaveLength(1)
    expect((await anon.from('community_setups').select('id').eq('id', data!.id)).data).toHaveLength(1)
  })

  it('the view names no account: an opaque key, the same for all of one author', async () => {
    const one = (await free.db.from('public_setups').insert({ ...setup, name: 'Um' }).select('id').single()).data!.id
    const two = (await free.db.from('public_setups').insert({ ...setup, name: 'Dois' }).select('id').single()).data!.id
    const other = (await pro.db.from('public_setups').insert({ ...setup, name: 'Outro' }).select('id').single()).data!.id
    expect((await anon.from('community_setups').select('user_id').eq('id', one)).error).not.toBeNull()
    const key = async (id: string) => (await anon.from('community_setups').select('author_key').eq('id', id).single()).data?.author_key
    expect(await key(one)).toBe(await key(two))
    expect(await key(one)).not.toBe(await key(other))
    expect([free.id, pro.id]).not.toContain(await key(one))
  })

  it('mine and setup_ref only for the author', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, setup_ref: 'ref-private' }).select('id').single()
    const cols = 'mine, setup_ref'
    expect((await free.db.from('community_setups').select(cols).eq('id', data!.id).single()).data).toEqual({ mine: true, setup_ref: 'ref-private' })
    expect((await pro.db.from('community_setups').select(cols).eq('id', data!.id).single()).data).toEqual({ mine: false, setup_ref: null })
    expect((await anon.from('community_setups').select(cols).eq('id', data!.id).single()).data).toEqual({ mine: false, setup_ref: null })
  })

  it('a report keeps its reason for the moderation queue', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'Falso' }).select('id').single()
    for (const n of ['why1', 'why2', 'why3']) await (await user(n)).db.from('reports').insert({ setup_id: data!.id, reason: 'false' })
    expect((await admin.from('moderation_queue').select('reasons').eq('id', data!.id).single()).data?.reasons).toEqual(['false', 'false', 'false'])
  })
})

describe('why to trust a recipe', () => {
  const setup = { racket_id: 'stock-x', name: 'Confiança', config: { leadG: { tip: 2 } }, specs: { weightG: 330, balanceCm: 32, swingweight: 330 } }
  const after = { weightG: 331, balanceCm: 32.05, swingweight: 328, strung: true, date: 1 }

  it('the author publishes and updates the measurement after the lead', async () => {
    const { data, error } = await free.db.from('public_setups').insert({ ...setup, measured_after: after }).select('id').single()
    expect(error).toBeNull()
    expect((await anon.from('community_setups').select('measured_after').eq('id', data!.id).single()).data?.measured_after).toEqual(after)
    expect((await free.db.from('public_setups').update({ measured_after: null }).eq('id', data!.id)).error).toBeNull()
    expect((await anon.from('community_setups').select('measured_after').eq('id', data!.id).single()).data?.measured_after).toBeNull()
  })

  it('a play counts once per player, never the author’s, never without an account', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'Jogada' }).select('id').single()
    const plays = async () => (await anon.from('community_setups').select('plays').eq('id', data!.id).single()).data?.plays
    await free.db.rpc('count_play', { setup_id: data!.id })
    expect((await anon.rpc('count_play', { setup_id: data!.id })).error).not.toBeNull()
    expect(await plays()).toBe(0)
    await pro.db.rpc('count_play', { setup_id: data!.id })
    await pro.db.rpc('count_play', { setup_id: data!.id })
    const other = await user('player')
    await other.db.rpc('count_play', { setup_id: data!.id })
    expect(await plays()).toBe(2)
    // Nobody reads who played.
    expect((await pro.db.from('recipe_plays').select('user_id').eq('setup_id', data!.id)).data ?? []).toEqual([])
  })

  it('plays cannot be written by hand', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...setup, name: 'À mão' }).select('id').single()
    expect((await pro.db.from('recipe_plays').insert({ setup_id: data!.id, user_id: pro.id })).error).not.toBeNull()
  })
})

describe('community recipes', () => {
  const rid = `stock-recipe-${stamp}`
  const recipe = { racket_id: rid, name: 'Estável', config: { leadG: { threeNine: 4 } }, specs: { weightG: 332 } }
  const results = { sessions: 12, hours: 9, avg: { overall: 4.3, comfort: 4.1 } }

  it('publishes with goals, level and results', async () => {
    const { data, error } = await free.db
      .from('public_setups')
      .insert({ ...recipe, goals: ['stability', 'control'], level: 'advanced', style: 'baseline', results, setup_ref: 'local-1' })
      .select('goals, level, style, results')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ goals: ['stability', 'control'], level: 'advanced', style: 'baseline', results })
  })

  it('refuses three goals, an unknown goal, and a partner badge', async () => {
    expect((await free.db.from('public_setups').insert({ ...recipe, goals: ['stability', 'power', 'spin'] })).error).not.toBeNull()
    expect((await free.db.from('public_setups').insert({ ...recipe, goals: ['speed'] })).error).not.toBeNull()
    expect((await free.db.from('public_setups').insert({ ...recipe, partner: 'Loja X' })).error).not.toBeNull()
  })

  it('the same setup_ref twice is refused', async () => {
    expect((await free.db.from('public_setups').insert({ ...recipe, setup_ref: 'twice' })).error).toBeNull()
    expect((await free.db.from('public_setups').insert({ ...recipe, setup_ref: 'twice' })).error?.code).toBe('23505')
  })

  it('authors update their recipe, never its counters, visibility, badge or owner', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...recipe, setup_ref: 'edit-me' }).select('id').single()
    const id = data!.id
    const ok = await free.db.from('public_setups').update({ goals: ['comfort'], results, updated_at: new Date().toISOString() }).eq('id', id)
    expect(ok.error).toBeNull()
    for (const change of [{ copies: 99 }, { hidden: true }, { partner: 'Eu' }, { user_id: pro.id }]) {
      expect((await free.db.from('public_setups').update(change).eq('id', id)).error).not.toBeNull()
    }
    const row = (await admin.from('public_setups').select('goals, results, copies, hidden, partner, user_id').eq('id', id).single()).data
    expect(row).toEqual({ goals: ['comfort'], results, copies: 0, hidden: false, partner: null, user_id: free.id })
  })

  it('nobody updates someone else’s recipe', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...recipe, setup_ref: 'not-yours' }).select('id').single()
    await pro.db.from('public_setups').update({ name: 'Roubado' }).eq('id', data!.id)
    expect((await anon.from('community_setups').select('name').eq('id', data!.id).single()).data?.name).toBe('Estável')
  })

  it('copies and reports still work through their functions', async () => {
    const { data } = await free.db.from('public_setups').insert({ ...recipe, setup_ref: 'counted' }).select('id').single()
    await anon.rpc('count_copy', { setup_id: data!.id })
    expect((await anon.from('community_setups').select('copies').eq('id', data!.id).single()).data?.copies).toBe(1)
    for (const n of ['rr1', 'rr2', 'rr3']) await (await user(n)).db.from('reports').insert({ setup_id: data!.id })
    expect((await anon.from('community_setups').select('id').eq('id', data!.id)).data).toEqual([])
  })

  it('counts per frame show only visible setups, to anyone', async () => {
    const visible = (await admin.from('public_setups').select('id').eq('racket_id', rid).eq('hidden', false)).data!.length
    const { data, error } = await anon.from('public_setup_counts').select('n').eq('racket_id', rid).single()
    expect(error).toBeNull()
    expect(data?.n).toBe(visible)
    expect(visible).toBeGreaterThan(0)
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
