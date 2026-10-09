import Dexie, { type EntityTable } from 'dexie'
import { z } from 'zod'
import { SESSION_KINDS, type Session, type Stringing } from '../domain/journal'
import { MATERIALS } from '../domain/strings'
import { POSITIONS, type Racket, type Setup } from '../domain/types'
import { STOCK_RACKETS } from './rackets'

/** A change waiting to be synced: the item is read again when it is sent,
 *  and a missing item means it was deleted. */
export interface OutboxEntry {
  key: string
  kind: string
  id: string
  /** When it changed (ms); a deletion is sent with this time. */
  at: number
}

export type SwingDb = Dexie & {
  rackets: EntityTable<Racket, 'id'>
  setups: EntityTable<Setup, 'id'>
  stringings: EntityTable<Stringing, 'id'>
  sessions: EntityTable<Session, 'id'>
  outbox: EntityTable<OutboxEntry, 'key'>
}

export function openDb(name: string): SwingDb {
  const d = new Dexie(name) as SwingDb
  // Custom rackets only; stock rackets live in code and are merged on read.
  d.version(1).stores({
    rackets: 'id, brand, type, updatedAt',
    setups: 'id, racketId, favourite, updatedAt',
  })
  // v2: the journal.
  d.version(2).stores({
    stringings: 'id, label, date',
    sessions: 'id, stringingId, date',
  })
  // v3: changes waiting to sync with the account.
  d.version(3).stores({ outbox: 'key' })
  return d
}

export const db = openDb('swingmath')

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const num = (lo: number, hi: number) => z.number().finite().min(lo).max(hi)

export const racketSchema = z.object({
  id: z.string().min(1),
  brand: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1970).max(2100).optional(),
  type: z.enum(['power', 'control', 'tweener', 'junior']),
  isStock: z.boolean(),
  source: z.string().optional(),
  pattern: z.string().max(10).optional(),
  strung: z.object({ weightG: z.number(), balanceCm: z.number(), swingweight: z.number() }).optional(),
  lengthCm: num(60, 74),
  headSizeSqIn: num(85, 120),
  weightG: num(150, 450),
  balanceCm: num(25, 40),
  swingweight: num(150, 450),
  twistweight: num(5, 25).optional(),
  ra: num(40, 80).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const leadSchema = z.object(Object.fromEntries(POSITIONS.map((p) => [p, num(0, 50)])) as Record<
  (typeof POSITIONS)[number],
  z.ZodNumber
>)

export const extraSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['hoop', 'shaft']),
  hour: z.number().min(0.5).max(11.5).optional(),
  cm: num(1, 74).optional(),
  sides: z.union([z.literal(1), z.literal(2)]),
  grams: num(0, 50),
})

const stringSpecSchema = z.object({
  material: z.enum(MATERIALS),
  tensionKg: num(10, 40),
  name: z.string().trim().max(60).optional(),
  gaugeMm: num(1, 1.6).optional(),
})
export const stringbedSchema = z.object({ mains: stringSpecSchema, crosses: stringSpecSchema.optional() })

const rating = z.number().int().min(1).max(5).optional()

export const setupSchema = z.object({
  id: z.string().min(1),
  racketId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  favourite: z.boolean(),
  baseMode: z.enum(['reference', 'measured']),
  measured: z.object({
    weightG: num(150, 450).optional(),
    balanceCm: num(25, 40).optional(),
    swingweight: num(150, 450).optional(),
    twistweight: num(5, 25).optional(),
  }),
  accessories: z.object({
    strings: z.boolean(),
    leatherGrip: z.boolean(),
    overgrip: z.boolean(),
    dampener: z.boolean(),
  }),
  leadG: leadSchema,
  extra: z.array(extraSchema).max(12).optional(),
  grip: z
    .object({ base: z.number().int().min(0).max(5), extraOvergrips: z.number().int().min(0).max(3), sleeves: z.number().int().min(0).max(3) })
    .optional(),
  strings: stringbedSchema.optional(),
  ratings: z.object({ forehand: rating, backhand: rating, serve: rating, volley: rating }),
  notes: z.string().max(500).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const rating5 = z.number().int().min(1).max(5).optional()

export const stringingSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  racketId: z.string().min(1),
  setupId: z.string().optional(),
  date: z.number(),
  bed: stringbedSchema,
  lifeHours: num(2, 200).optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const sessionSchema = z.object({
  id: z.string().min(1),
  date: z.number(),
  minutes: num(5, 600),
  kind: z.enum(SESSION_KINDS),
  stringingId: z.string().optional(),
  ratings: z.object({ overall: rating5, power: rating5, control: rating5, spin: rating5, comfort: rating5 }),
  armPain: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export async function saveStringing(s: Stringing) {
  await db.stringings.put(stringingSchema.parse(s) as Stringing)
}

export async function saveSession(s: Session) {
  await db.sessions.put(sessionSchema.parse(s) as Session)
}

/** Deletes a stringing; its sessions stay, unlinked. */
export async function deleteStringing(id: string) {
  await db.transaction('rw', db.stringings, db.sessions, async () => {
    await db.sessions.where('stringingId').equals(id).modify((s) => {
      delete s.stringingId
    })
    await db.stringings.delete(id)
  })
}

export async function saveRacket(r: Racket) {
  await db.rackets.put(racketSchema.parse(r) as Racket)
}

export async function saveSetup(s: Setup) {
  await db.setups.put(setupSchema.parse(s) as Setup)
}

export async function deleteRacket(id: string) {
  await db.transaction('rw', db.rackets, db.setups, async () => {
    await db.setups.where('racketId').equals(id).delete()
    await db.rackets.delete(id)
  })
}

export function findRacket(id: string | undefined, custom: Racket[] | undefined): Racket | undefined {
  if (!id) return undefined
  return STOCK_RACKETS.find((r) => r.id === id) ?? custom?.find((r) => r.id === id)
}

export async function exportAll() {
  const [rackets, setups, stringings, sessions] = await Promise.all([
    db.rackets.toArray(),
    db.setups.toArray(),
    db.stringings.toArray(),
    db.sessions.toArray(),
  ])
  return { app: 'swingmath', version: 2, exportedAt: new Date().toISOString(), rackets, setups, stringings, sessions }
}

export async function importAll(data: unknown) {
  const parsed = z
    .object({
      app: z.literal('swingmath'),
      rackets: z.array(racketSchema),
      setups: z.array(setupSchema),
      // Version 1 backups have no journal.
      stringings: z.array(stringingSchema).default([]),
      sessions: z.array(sessionSchema).default([]),
    })
    .parse(data)
  await db.transaction('rw', [db.rackets, db.setups, db.stringings, db.sessions], async () => {
    await db.rackets.bulkPut(parsed.rackets as Racket[])
    await db.setups.bulkPut(parsed.setups as Setup[])
    await db.stringings.bulkPut(parsed.stringings as Stringing[])
    await db.sessions.bulkPut(parsed.sessions as Session[])
  })
  return { rackets: parsed.rackets.length, setups: parsed.setups.length, sessions: parsed.sessions.length }
}

/** Wipes this device. Clearing does not queue deletions, so an account's
 *  copy in the cloud stays (signing in again brings it back). */
export async function deleteAll() {
  await db.transaction('rw', [db.rackets, db.setups, db.stringings, db.sessions, db.outbox], async () => {
    await Promise.all([db.rackets.clear(), db.setups.clear(), db.stringings.clear(), db.sessions.clear(), db.outbox.clear()])
  })
}
