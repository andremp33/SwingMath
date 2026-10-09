import 'fake-indexeddb/auto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, it } from 'vitest'
import { openDb } from '../src/data/db'
import { enqueueAll, supabaseRemote, syncOnce, SyncError, trackChanges } from '../src/data/sync'
import type { Setup } from '../src/domain/types'
import { env } from './env'

const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const stamp = Date.now()
const made: string[] = []

async function account(name: string, pro: boolean) {
  const email = `${name}-${stamp}@example.test`
  const { data } = await admin.auth.admin.createUser({ email, password: 'test-password-1', email_confirm: true })
  made.push(data.user!.id)
  if (pro) await admin.from('subscriptions').insert({ email, status: 'active' })
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email, password: 'test-password-1' })
  return supabaseRemote(client)
}

const setup = (id: string, name: string, updatedAt: number): Setup => ({
  id, name, racketId: 'stock-x', favourite: false, baseMode: 'reference', measured: {},
  accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
  leadG: { tip: 1, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 }, ratings: {}, createdAt: 1, updatedAt,
})
const settle = () => new Promise((r) => setTimeout(r, 20))

afterAll(async () => {
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

  it('a free account gets a clear error and keeps its queue', async () => {
    const remote = await account('nosync', false)
    const a = openDb(`cloud-free-${stamp}`)
    trackChanges(a)
    await a.setups.put(setup('s1', 'Base', 1000))
    await enqueueAll(a)
    await expect(syncOnce(a, remote, null)).rejects.toBeInstanceOf(SyncError)
    expect(await a.outbox.count()).toBe(1)
  })
})
