import 'fake-indexeddb/auto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../src/data/db'
import { enqueueAll, supabaseRemote, syncOnce, SyncError, trackChanges } from '../src/data/sync'
import type { Setup } from '../src/domain/types'
import { env } from './env'

const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const stamp = Date.now()
const made: string[] = []

/** A signed-in client on one device (the header the app sends). */
async function device(email: string, id: string) {
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false }, global: { headers: { 'x-swing-device': id } } })
  await client.auth.signInWithPassword({ email, password: 'test-password-1' })
  return client
}

async function user(name: string, pro: boolean) {
  const email = `${name}-${stamp}@example.test`
  const { data } = await admin.auth.admin.createUser({ email, password: 'test-password-1', email_confirm: true })
  made.push(data.user!.id)
  if (pro) await admin.from('subscriptions').insert({ email, status: 'active' })
  return email
}

async function account(name: string, pro: boolean) {
  return supabaseRemote(await device(await user(name, pro), `device-${name}-${stamp}`))
}

const setup = (id: string, name: string, updatedAt: number): Setup => ({
  id, name, racketId: 'stock-x', favourite: false, baseMode: 'reference', measured: {},
  accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
  leadG: { tip: 1, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 }, ratings: {}, createdAt: 1, updatedAt,
})
const settle = () => new Promise((r) => setTimeout(r, 20))

beforeAll(async () => {
  await admin.from('app_flags').update({ enabled: false }).eq('name', 'pro_beta')
})

afterAll(async () => {
  await admin.from('app_flags').update({ enabled: true }).eq('name', 'pro_beta')
  for (const id of made) await admin.auth.admin.deleteUser(id)
  await admin.from('subscriptions').delete().like('email', `%-${stamp}@example.test`)
})

describe('sync with the real server', () => {
  it('two devices on one Pro account', async () => {
    const remote = await account('sync', true)
    const a = openDb(`cloud-a-${stamp}`)
    const b = openDb(`cloud-b-${stamp}`)
    trackChanges(a)
    trackChanges(b)
    await a.setups.put(setup('s1', 'Base', 1000))
    await settle()
    let ca = (await syncOnce(a, remote, null)).cursor
    let cb = (await syncOnce(b, remote, null)).cursor
    expect((await b.setups.get('s1'))?.name).toBe('Base')
    await b.setups.put(setup('s1', 'Renamed on B', 2000))
    await settle()
    cb = (await syncOnce(b, remote, cb)).cursor
    ca = (await syncOnce(a, remote, ca)).cursor
    expect((await a.setups.get('s1'))?.name).toBe('Renamed on B')
    await a.setups.delete('s1')
    await settle()
    ca = (await syncOnce(a, remote, ca)).cursor
    await syncOnce(b, remote, cb)
    expect(await b.setups.get('s1')).toBeUndefined()
    expect(ca).not.toBeNull()
  })

  it('a free account syncs too: the cloud is everyone\'s backup', async () => {
    const remote = await account('freesync', false)
    const a = openDb(`cloud-free-${stamp}`)
    const b = openDb(`cloud-free-b-${stamp}`)
    trackChanges(a)
    await a.setups.put(setup('s1', 'Base', 1000))
    await enqueueAll(a)
    expect((await syncOnce(a, remote, null)).pushed).toBe(1)
    expect(await a.outbox.count()).toBe(0)
    await syncOnce(b, remote, null)
    expect((await b.setups.get('s1'))?.name).toBe('Base')
  })

  it('signed out, a write is refused and the queue is kept', async () => {
    const remote = supabaseRemote(createClient(env.url, env.anonKey, { auth: { persistSession: false } }))
    const a = openDb(`cloud-anon-${stamp}`)
    trackChanges(a)
    await a.setups.put(setup('s1', 'Base', 1000))
    await enqueueAll(a)
    await expect(syncOnce(a, remote, null)).rejects.toBeInstanceOf(SyncError)
    expect(await a.outbox.count()).toBe(1)
  })

  it('without Pro, one device at a time: signing in elsewhere moves the sync there', async () => {
    const email = await user('onedevice', false)
    const a = await device(email, `device-a-${stamp}`)
    const b = await device(email, `device-b-${stamp}`)
    const db = openDb(`cloud-one-${stamp}`)
    trackChanges(db)
    await db.setups.put(setup('s1', 'Base', 1000))
    await enqueueAll(db)
    // A claims the sync and sends its setup.
    expect((await a.rpc('claim_sync_device')).error).toBeNull()
    expect((await a.rpc('sync_here')).data).toBe(true)
    expect((await syncOnce(db, supabaseRemote(a), null)).pushed).toBe(1)
    // B signs in: it takes the sync and gets A's setup.
    expect((await b.rpc('sync_here')).data).toBe(false)
    await b.rpc('claim_sync_device')
    const dbB = openDb(`cloud-one-b-${stamp}`)
    await syncOnce(dbB, supabaseRemote(b), null)
    expect((await dbB.setups.get('s1'))?.name).toBe('Base')
    // A is refused now, reading and writing, and keeps its queue.
    expect((await a.rpc('sync_here')).data).toBe(false)
    expect((await a.from('items').select('id')).data).toEqual([])
    await db.setups.put(setup('s1', 'Renamed on A', 2000))
    await settle()
    const err = await syncOnce(db, supabaseRemote(a), null).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SyncError)
    expect((err as SyncError).code).toBe('42501')
    expect(await db.outbox.count()).toBe(1)
    // Taking it back works.
    await a.rpc('claim_sync_device')
    expect((await syncOnce(db, supabaseRemote(a), null)).pushed).toBe(1)
  })

  it('with Pro, every device syncs', async () => {
    const email = await user('manydevices', true)
    const a = await device(email, `device-pa-${stamp}`)
    const b = await device(email, `device-pb-${stamp}`)
    await a.rpc('claim_sync_device')
    await b.rpc('claim_sync_device')
    expect((await a.rpc('sync_here')).data).toBe(true)
    expect((await b.rpc('sync_here')).data).toBe(true)
  })

  it('a device without its header cannot claim the sync', async () => {
    const email = await user('noheader', false)
    const c = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
    await c.auth.signInWithPassword({ email, password: 'test-password-1' })
    expect((await c.rpc('claim_sync_device')).error?.code).toBe('22023')
  })
})
