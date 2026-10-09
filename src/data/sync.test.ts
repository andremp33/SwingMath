import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Setup } from '../domain/types'
import { openDb, type SwingDb } from './db'
import { applyRemote, enqueueAll, syncOnce, trackChanges, type Remote, type RemoteRow } from './sync'

/** The server's rules, in memory: newest client version wins, and every
 *  write gets a later server time. */
function fakeServer() {
  const rows = new Map<string, RemoteRow & { updated_at: string }>()
  let clock = Date.UTC(2026, 9, 9)
  const remote: Remote = {
    async push(batch) {
      for (const r of batch) {
        const key = `${r.kind}:${r.id}`
        const old = rows.get(key)
        if (old && r.client_updated_at < old.client_updated_at) continue
        rows.set(key, { ...structuredClone(r), updated_at: new Date(++clock).toISOString() })
      }
    },
    async pull(since) {
      return [...rows.values()].filter((r) => !since || r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    },
  }
  return { remote, rows }
}

const setup = (id: string, name: string, updatedAt: number): Setup => ({
  id,
  name,
  racketId: 'stock-x',
  favourite: false,
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
  leadG: { tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 },
  ratings: {},
  createdAt: 1,
  updatedAt,
})

let n = 0
async function device(): Promise<{ db: SwingDb; cursor: string | null; sync: (r: Remote) => Promise<void> }> {
  const db = openDb(`test-${++n}`)
  trackChanges(db)
  const d = {
    db,
    cursor: null as string | null,
    async sync(r: Remote) {
      d.cursor = (await syncOnce(db, r, d.cursor)).cursor
    },
  }
  return d
}
/** Hooks queue changes once the write commits; give them a tick. */
const settle = () => new Promise((r) => setTimeout(r, 20))

describe('sync', () => {
  let server: ReturnType<typeof fakeServer>
  beforeEach(() => {
    server = fakeServer()
  })

  it('a change on one device reaches the other', async () => {
    const a = await device()
    const b = await device()
    await a.db.setups.put(setup('s1', 'Base', 10))
    await settle()
    await a.sync(server.remote)
    expect(await a.db.outbox.count()).toBe(0)
    await b.sync(server.remote)
    expect((await b.db.setups.get('s1'))?.name).toBe('Base')
    // Applying server data does not queue it back.
    await settle()
    expect(await b.db.outbox.count()).toBe(0)
  })

  it('deletions travel too', async () => {
    const a = await device()
    const b = await device()
    await a.db.setups.put(setup('s1', 'Base', 10))
    await settle()
    await a.sync(server.remote)
    await b.sync(server.remote)
    await b.db.setups.delete('s1')
    await settle()
    await b.sync(server.remote)
    await a.sync(server.remote)
    expect(await a.db.setups.get('s1')).toBeUndefined()
    expect(server.rows.get('setup:s1')?.deleted).toBe(true)
  })

  it('the newest edit wins, whichever device syncs last', async () => {
    const a = await device()
    const b = await device()
    await a.db.setups.put(setup('s1', 'Base', 10))
    await settle()
    await a.sync(server.remote)
    await b.sync(server.remote)
    await b.db.setups.put(setup('s1', 'Newer on B', 30))
    await a.db.setups.put(setup('s1', 'Older on A', 20))
    await settle()
    await b.sync(server.remote)
    await a.sync(server.remote)
    expect((await a.db.setups.get('s1'))?.name).toBe('Newer on B')
    expect(server.rows.get('setup:s1')?.data).toMatchObject({ name: 'Newer on B' })
  })

  it('first sync sends what was on the device before signing in', async () => {
    const a = await device()
    await a.db.setups.put(setup('old', 'Before account', 5))
    await a.db.outbox.clear()
    await enqueueAll(a.db)
    await a.sync(server.remote)
    expect(server.rows.has('setup:old')).toBe(true)
  })

  it('invalid data from the server is ignored', async () => {
    const a = await device()
    const bad = { ...setup('bad', '', 9), name: '' }
    const changed = await applyRemote(a.db, [{ kind: 'setup', id: 'bad', data: bad, deleted: false, client_updated_at: 9 }])
    expect(changed).toBe(0)
    expect(await a.db.setups.get('bad')).toBeUndefined()
  })

  it('a local deletion newer than the server copy is kept', async () => {
    const a = await device()
    await a.db.setups.put(setup('s1', 'Base', 10))
    await settle()
    await a.db.setups.delete('s1')
    await settle()
    // The server still has an older copy from another device.
    await applyRemote(a.db, [{ kind: 'setup', id: 's1', data: setup('s1', 'Base', 5), deleted: false, client_updated_at: 5 }])
    expect(await a.db.setups.get('s1')).toBeUndefined()
  })
})
