import Dexie, { type EntityTable } from 'dexie'
import { z } from 'zod'
import { POSITIONS, type Racket, type Setup } from '../domain/types'
import { STOCK_RACKETS } from './rackets'

export const db = new Dexie('swingmath') as Dexie & {
  rackets: EntityTable<Racket, 'id'>
  setups: EntityTable<Setup, 'id'>
}

// Custom rackets only; stock rackets live in code and are merged on read.
db.version(1).stores({
  rackets: 'id, brand, type, updatedAt',
  setups: 'id, racketId, favourite, updatedAt',
})

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
  ratings: z.object({ forehand: rating, backhand: rating, serve: rating, volley: rating }),
  notes: z.string().max(500).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

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
  const [rackets, setups] = await Promise.all([db.rackets.toArray(), db.setups.toArray()])
  return { app: 'swingmath', version: 1, exportedAt: new Date().toISOString(), rackets, setups }
}

export async function importAll(data: unknown) {
  const parsed = z
    .object({ app: z.literal('swingmath'), rackets: z.array(racketSchema), setups: z.array(setupSchema) })
    .parse(data)
  await db.transaction('rw', db.rackets, db.setups, async () => {
    await db.rackets.bulkPut(parsed.rackets as Racket[])
    await db.setups.bulkPut(parsed.setups as Setup[])
  })
  return { rackets: parsed.rackets.length, setups: parsed.setups.length }
}

export async function deleteAll() {
  await db.transaction('rw', db.rackets, db.setups, async () => {
    await db.rackets.clear()
    await db.setups.clear()
  })
}
