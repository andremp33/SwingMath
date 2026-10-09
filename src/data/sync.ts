import type { SupabaseClient } from '@supabase/supabase-js'
import type { Table } from 'dexie'
import type { z } from 'zod'
import { racketSchema, sessionSchema, setupSchema, stringingSchema, type SwingDb } from './db'

/**
 * Sync between this device and the account (Pro).
 *
 * Every local change is queued in `outbox` (by Dexie hooks, after the write
 * commits). A sync sends the queue, then fetches what changed on the server
 * since the last time. Each item carries its own updatedAt and the newest
 * version wins, on the server (a trigger) and here. Deletions travel as
 * tombstones. Incoming data is validated before it is stored.
 */
export const KINDS = {
  racket: { table: 'rackets', schema: racketSchema },
  setup: { table: 'setups', schema: setupSchema },
  stringing: { table: 'stringings', schema: stringingSchema },
  session: { table: 'sessions', schema: sessionSchema },
} as const satisfies Record<string, { table: keyof SwingDb; schema: z.ZodType }>
export type Kind = keyof typeof KINDS
const kinds = Object.keys(KINDS) as Kind[]

type Item = { id: string; updatedAt: number }
const tableOf = (db: SwingDb, kind: Kind) => db[KINDS[kind].table] as unknown as Table<Item, string>

export interface RemoteRow {
  kind: Kind
  id: string
  data: Item | null
  deleted: boolean
  client_updated_at: number
  /** Server time of the write (only on rows coming back). */
  updated_at?: string
}

export interface Remote {
  push(rows: RemoteRow[]): Promise<void>
  /** Rows written after `since` (server time), oldest first. */
  pull(since: string | null): Promise<RemoteRow[]>
}

// Writes made while applying server data must not be queued back.
const applying = new WeakSet<SwingDb>()
const tracked = new WeakSet<SwingDb>()

/** Queues every change to synced tables. `onChange` runs after each one. */
export function trackChanges(db: SwingDb, onChange?: () => void) {
  if (tracked.has(db)) return
  tracked.add(db)
  for (const kind of kinds) {
    const table = tableOf(db, kind)
    const queue = (id: string, trans: { on(e: 'complete', fn: () => void): void }) => {
      if (applying.has(db)) return
      const at = Date.now()
      trans.on('complete', () => {
        db.outbox.put({ key: `${kind}:${id}`, kind, id, at }).then(() => onChange?.(), () => {})
      })
    }
    table.hook('creating', function (key, obj, trans) {
      queue(String(key ?? obj.id), trans)
    })
    table.hook('updating', function (_mods, key, _obj, trans) {
      queue(String(key), trans)
    })
    table.hook('deleting', function (key, _obj, trans) {
      queue(String(key), trans)
    })
  }
}

/** Queues everything on this device: first sync, or a different account. */
export async function enqueueAll(db: SwingDb) {
  const at = Date.now()
  for (const kind of kinds) {
    const items = await tableOf(db, kind).toArray()
    await db.outbox.bulkPut(items.map((i) => ({ key: `${kind}:${i.id}`, kind, id: i.id, at })))
  }
}

const CHUNK = 200

async function push(db: SwingDb, remote: Remote) {
  const queued = await db.outbox.toArray()
  let sent = 0
  for (let i = 0; i < queued.length; i += CHUNK) {
    const batch = queued.slice(i, i + CHUNK)
    const rows: RemoteRow[] = []
    for (const e of batch) {
      if (!(e.kind in KINDS)) continue
      const item = await tableOf(db, e.kind as Kind).get(e.id)
      rows.push(
        item
          ? { kind: e.kind as Kind, id: e.id, data: item, deleted: false, client_updated_at: item.updatedAt }
          : { kind: e.kind as Kind, id: e.id, data: null, deleted: true, client_updated_at: e.at },
      )
    }
    await remote.push(rows)
    sent += rows.length
    // Drop only entries that did not change again while we were sending.
    await db.transaction('rw', db.outbox, async () => {
      for (const e of batch) {
        const now = await db.outbox.get(e.key)
        if (now && now.at === e.at) await db.outbox.delete(e.key)
      }
    })
  }
  return sent
}

/** Applies server rows; returns how many changed this device. */
export async function applyRemote(db: SwingDb, rows: RemoteRow[]) {
  let changed = 0
  const tables = kinds.map((k) => tableOf(db, k))
  applying.add(db)
  try {
    await db.transaction('rw', [...tables, db.outbox], async () => {
      for (const r of rows) {
        if (!(r.kind in KINDS)) continue
        const table = tableOf(db, r.kind)
        const local = await table.get(r.id)
        const pending = await db.outbox.get(`${r.kind}:${r.id}`)
        if (r.deleted) {
          // A local edit made after the deletion wins.
          if (local && local.updatedAt > r.client_updated_at) continue
          if (local) {
            await table.delete(r.id)
            changed++
          }
          continue
        }
        // A newer local version, or a local deletion made after it, wins.
        if (local && local.updatedAt >= r.client_updated_at) continue
        if (!local && pending && pending.at > r.client_updated_at) continue
        const parsed = KINDS[r.kind].schema.safeParse(r.data)
        if (!parsed.success) continue
        await table.put(parsed.data as Item)
        changed++
      }
    })
  } finally {
    applying.delete(db)
  }
  return changed
}

// Rows committed a moment before the last pull may show up late; fetching a
// little overlap is harmless because applying is idempotent.
const OVERLAP_MS = 2 * 60_000

export async function syncOnce(db: SwingDb, remote: Remote, cursor: string | null) {
  const pushed = await push(db, remote)
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null
  const rows = await remote.pull(since)
  const pulled = await applyRemote(db, rows)
  const last = rows.reduce<string | null>((m, r) => (r.updated_at && (!m || r.updated_at > m) ? r.updated_at : m), cursor)
  return { cursor: last, pushed, pulled }
}

export class SyncError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

const PAGE = 1000

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async push(rows) {
      if (!rows.length) return
      const { error } = await client.from('items').upsert(rows, { onConflict: 'user_id,kind,id' })
      if (error) throw new SyncError(error.message, error.code)
    },
    async pull(since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client.from('items').select('kind,id,data,deleted,client_updated_at,updated_at')
        if (since) q = q.gt('updated_at', since)
        const { data, error } = await q.order('updated_at', { ascending: true }).range(from, from + PAGE - 1)
        if (error) throw new SyncError(error.message, error.code)
        out.push(...((data ?? []) as RemoteRow[]))
        if (!data || data.length < PAGE) return out
      }
    },
  }
}
