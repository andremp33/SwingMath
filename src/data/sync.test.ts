import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_MEASUREMENTS } from '../domain/fleet'
import type { OwnedRacket } from '../domain/journal'
import type { Setup } from '../domain/types'
import { ensureOwned, openDb, type SwingDb } from './db'
import { applyRemote, enqueueAll, SyncError, syncOnce, trackChanges, type Remote, type RemoteRow } from './sync'

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

describe('owned rackets and an older server', () => {
  it('a server that refuses owned rackets still gets the rest; they wait in the queue', async () => {
    const { remote, rows } = fakeServer()
    const strict: Remote = {
      ...remote,
      async push(batch) {
        if (batch.some((r) => r.kind === 'owned')) throw new SyncError('check', '23514')
        return remote.push(batch)
      },
    }
    const a = await device()
    await a.db.setups.put(setup('s1', 'Mine', 5))
    await a.db.owned.put({ id: 'o1', name: 'Aero #1', racketId: 'stock-x', createdAt: 1, updatedAt: 6 })
    await new Promise((r) => setTimeout(r, 20))
    await a.sync(strict)
    expect(rows.has('setup:s1')).toBe(true)
    expect(rows.has('owned:o1')).toBe(false)
    expect(await a.db.outbox.get('owned:o1')).toBeDefined()
    // Once the server knows them, they go.
    await a.sync(remote)
    expect(rows.has('owned:o1')).toBe(true)
  })
})

describe('journals from before owned rackets', () => {
  it('get an owned racket per name on start, once', async () => {
    const d = openDb(`old-${++n}`)
    const bed = { mains: { material: 'poly' as const, tensionKg: 23 } }
    await d.stringings.bulkPut([
      { id: 's1', label: 'Aero #1', racketId: 'stock-x', date: 1, bed, createdAt: 1, updatedAt: 1 },
      { id: 's2', label: 'Aero #1', racketId: 'stock-x', date: 2, bed, createdAt: 2, updatedAt: 2 },
      { id: 's3', label: 'Blade', racketId: 'stock-y', date: 3, bed, createdAt: 3, updatedAt: 3 },
    ])
    await ensureOwned(d)
    await ensureOwned(d)
    const owned = await d.owned.toArray()
    expect(owned.map((o) => o.name).sort()).toEqual(['Aero #1', 'Blade'])
    const s = await d.stringings.toArray()
    expect(s.every((x) => x.ownedId)).toBe(true)
    expect(new Set(s.filter((x) => x.label === 'Aero #1').map((x) => x.ownedId)).size).toBe(1)
  })
})

describe('measurements and lead on owned rackets', () => {
  const measured = (count: number): OwnedRacket => ({
    id: 'o1',
    name: 'Aero #1',
    racketId: 'stock-x',
    measurements: Array.from({ length: count }, (_, i) => ({
      id: `m${i}`,
      date: 1_000_000 - i,
      weightG: 318.5,
      balanceCm: 32.15,
      swingweight: 324,
      twistweight: 14.2,
      strung: true,
      origin: i % 2 ? ('shop' as const) : ('pendulum' as const),
    })),
    lead: { leadG: { tip: 0, tenTwo: 0, threeNine: 2, throat: 0, handle: 4 }, extra: [{ id: 'x', kind: 'hoop', hour: 2, sides: 2, grams: 1 }] },
    createdAt: 1,
    updatedAt: 7,
  })

  it('travel to the other device whole, and the fullest racket fits the server’s 16 KB', async () => {
    const server = fakeServer()
    const a = await device()
    const b = await device()
    const o = measured(MAX_MEASUREMENTS)
    await a.db.owned.put(o)
    await settle()
    await a.sync(server.remote)
    await b.sync(server.remote)
    expect(await b.db.owned.get('o1')).toEqual(o)
    expect(new TextEncoder().encode(JSON.stringify(server.rows.get('owned:o1')!.data)).length).toBeLessThan(16_384)
  })

  it('a measurement that makes no sense, or one too many, is refused', async () => {
    const a = await device()
    const bad = measured(1)
    bad.measurements![0].weightG = 10
    expect(await applyRemote(a.db, [{ kind: 'owned', id: 'o1', data: bad, deleted: false, client_updated_at: 7 }])).toBe(0)
    expect(await applyRemote(a.db, [{ kind: 'owned', id: 'o1', data: measured(MAX_MEASUREMENTS + 1), deleted: false, client_updated_at: 7 }])).toBe(0)
    expect(await a.db.owned.get('o1')).toBeUndefined()
  })
})
