import type { Racket, SetupConfig, Specs } from '../domain/types'
import { getCloud } from './cloud'

/** Community data: medians of frames players measured, and setups they
 *  published. Reading needs no account; writing does. */

export interface MeasurementStats {
  strung: boolean
  n: number
  weight_g: number
  weight_p25: number
  weight_p75: number
  balance_cm: number | null
  balance_n: number
  swingweight: number | null
  swingweight_n: number
}

const cache = new Map<string, Promise<MeasurementStats[]>>()

export function measurementStats(racketId: string): Promise<MeasurementStats[]> {
  const c = getCloud()
  if (!c || !racketId.startsWith('stock-')) return Promise.resolve([])
  if (!cache.has(racketId)) {
    cache.set(
      racketId,
      c
        .then((cl) => cl.from('measurement_stats').select('*').eq('racket_id', racketId))
        .then(({ data }) => (data ?? []) as MeasurementStats[])
        .catch(() => {
          cache.delete(racketId)
          return []
        }),
    )
  }
  return cache.get(racketId)!
}

export interface MeasurementInput {
  racketId: string
  strung: boolean
  unit: number
  weightG: number
  balanceCm?: number
  swingweight?: number
}

/** Adds or replaces this player's measurement of one of their frames. */
export async function submitMeasurement(m: MeasurementInput) {
  const cl = await getCloud()!
  const { error } = await cl.from('measurements').upsert(
    {
      racket_id: m.racketId,
      strung: m.strung,
      unit: m.unit,
      weight_g: Math.round(m.weightG * 10) / 10,
      balance_cm: m.balanceCm === undefined ? null : Math.round(m.balanceCm * 100) / 100,
      swingweight: m.swingweight === undefined ? null : Math.round(m.swingweight * 10) / 10,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,racket_id,strung,unit' },
  )
  if (error) throw error
  cache.delete(m.racketId)
}

export interface PublicSetup {
  id: string
  user_id: string
  racket_id: string
  name: string
  author: string | null
  config: SetupConfig
  racket: Omit<Racket, 'createdAt' | 'updatedAt'> | null
  specs: Pick<Specs, 'weightG' | 'balanceCm' | 'swingweight'>
  copies: number
  created_at: string
}

export async function publicSetups(racketId: string, limit = 5): Promise<PublicSetup[]> {
  const c = getCloud()
  if (!c) return []
  const { data } = await (await c)
    .from('public_setups')
    .select('id, user_id, racket_id, name, author, config, racket, specs, copies, created_at')
    .eq('racket_id', racketId)
    .order('copies', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as PublicSetup[]
}

export async function publishSetup(p: { name: string; author?: string; config: SetupConfig; racket: Racket; specs: Specs }) {
  const cl = await getCloud()!
  const { racketId, baseMode, measured, accessories, leadG, extra, grip, strings } = p.config
  const { createdAt: _c, updatedAt: _u, ...frame } = p.racket
  const { error } = await cl.from('public_setups').insert({
    racket_id: racketId,
    name: p.name.trim().slice(0, 60),
    author: p.author?.trim().slice(0, 30) || null,
    config: { racketId, baseMode, measured, accessories, leadG, extra, grip, strings },
    // Custom frames travel with the setup, like a share link.
    racket: p.racket.isStock ? null : frame,
    specs: { weightG: p.specs.weightG, balanceCm: p.specs.balanceCm, swingweight: p.specs.swingweight },
  })
  if (error) throw error
}

export async function countCopy(id: string) {
  const c = getCloud()
  if (c) await (await c).rpc('count_copy', { setup_id: id })
}

export async function reportSetup(id: string) {
  const cl = await getCloud()!
  const { error } = await cl.from('reports').insert({ setup_id: id })
  // Reporting twice is fine.
  if (error && error.code !== '23505') throw error
}

export async function deletePublicSetup(id: string) {
  const cl = await getCloud()!
  const { error } = await cl.from('public_setups').delete().eq('id', id)
  if (error) throw error
}
