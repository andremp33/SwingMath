import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { racketSchema, setupSchema } from '../data/db'
import { MIN_RESULT_SESSIONS, SESSION_RATINGS, type SessionRating } from '../domain/journal'
import type { Racket, SetupConfig, Specs } from '../domain/types'
import { cloudConfigured, getCloud } from './cloud'
import { hasBlockedWords } from './wordFilter'

/** Community data: medians of frames players measured, and setups they
 *  published. Reading needs no account; writing does. */

/** On the website and in the app alike, wherever the cloud is set up. */
export const communityEnabled = () => cloudConfigured()

const cloud = () => (communityEnabled() ? getCloud() : null)

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
  const c = cloud()
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

export const GOALS = ['stability', 'power', 'manoeuvrability', 'spin', 'control', 'comfort'] as const
export type Goal = (typeof GOALS)[number]
export const LEVELS = ['beginner', 'intermediate', 'advanced', 'competition'] as const
export type Level = (typeof LEVELS)[number]
export const STYLES = ['baseline', 'allcourt', 'net'] as const
export type Style = (typeof STYLES)[number]

/** A recipe's journal results, as published: never arm pain or notes. */
export interface PublicResults {
  sessions: number
  hours: number
  avg: Partial<Record<SessionRating, number>>
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
  goals: Goal[]
  level: Level | null
  style: Style | null
  results: PublicResults | null
  setup_ref: string | null
  partner: string | null
  updated_at: string
}

const score = z.number().finite().min(1).max(5)
const resultsSchema = z.object({
  sessions: z.number().int().min(0).max(100_000),
  hours: z.number().finite().min(0).max(100_000),
  avg: z.object(Object.fromEntries(SESSION_RATINGS.map((k) => [k, score.optional()])) as Record<SessionRating, z.ZodOptional<typeof score>>),
})
const configSchema = setupSchema.pick({ racketId: true, baseMode: true, measured: true, accessories: true, leadG: true, extra: true, grip: true, strings: true })
const finite = z.number().finite()
/** Rows are written by other players: each one is checked before the app uses it. */
const rowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  racket_id: z.string(),
  name: z.string().min(1),
  author: z.string().nullable(),
  config: configSchema,
  racket: racketSchema.omit({ createdAt: true, updatedAt: true }).nullable(),
  specs: z.object({ weightG: finite, balanceCm: finite, swingweight: finite }),
  copies: z.number().int().min(0),
  created_at: z.string(),
  goals: z.array(z.enum(GOALS)).max(2).default([]),
  level: z.enum(LEVELS).nullable().default(null),
  style: z.enum(STYLES).nullable().default(null),
  results: resultsSchema.nullable().default(null),
  setup_ref: z.string().nullable().default(null),
  partner: z.string().nullable().default(null),
  updated_at: z.string(),
})

/** Keeps the rows that pass the schema; drops the rest without a fuss. */
export function parsePublicSetups(rows: unknown[]): PublicSetup[] {
  return rows.flatMap((r) => {
    const p = rowSchema.safeParse(r)
    return p.success ? [p.data as PublicSetup] : []
  })
}

const COLUMNS = 'id, user_id, racket_id, name, author, config, racket, specs, copies, created_at, goals, level, style, results, setup_ref, partner, updated_at'

export async function publicSetups(racketId: string): Promise<PublicSetup[]> {
  const c = cloud()
  if (!c) return []
  const { data } = await (await c).from('public_setups').select(COLUMNS).eq('racket_id', racketId).order('created_at', { ascending: false }).limit(50)
  return parsePublicSetups(data ?? [])
}

const hasResults = (p: PublicSetup) => (p.results?.sessions ?? 0) >= MIN_RESULT_SESSIONS

/**
 * The order players see: partner shops first, then recipes with journal
 * results (best overall first), then the most copied, then the newest.
 */
export function rankPublicSetups(list: PublicSetup[], goal?: Goal): PublicSetup[] {
  return list
    .filter((p) => !goal || p.goals.includes(goal))
    .sort(
      (a, b) =>
        Number(!!b.partner) - Number(!!a.partner) ||
        Number(hasResults(b)) - Number(hasResults(a)) ||
        (hasResults(a) && hasResults(b) ? (b.results!.avg.overall ?? 0) - (a.results!.avg.overall ?? 0) : 0) ||
        b.copies - a.copies ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
}

/** Published averages to a tenth, hours to the half hour. */
export function roundResults(r: PublicResults): PublicResults {
  const avg: PublicResults['avg'] = {}
  for (const k of SESSION_RATINGS) if (r.avg[k] !== undefined) avg[k] = Math.round(r.avg[k]! * 10) / 10
  return { sessions: r.sessions, hours: Math.round(r.hours * 2) / 2, avg }
}

async function myId(cl: SupabaseClient) {
  return (await cl.auth.getSession()).data.session?.user.id
}

/** My published copy of a saved setup, if there is one. */
export async function myRecipe(setupRef: string): Promise<PublicSetup | null> {
  const c = cloud()
  if (!c) return null
  const cl = await c
  const uid = await myId(cl)
  if (!uid) return null
  const { data } = await cl.from('public_setups').select(COLUMNS).eq('user_id', uid).eq('setup_ref', setupRef).maybeSingle()
  return data ? (parsePublicSetups([data])[0] ?? null) : null
}

/** My earlier publish of a saved setup: which row, which frame, and
 *  whether reports hid it. */
export interface Published {
  id: string
  racket_id: string
  hidden: boolean
}

async function published(cl: SupabaseClient, setupRef: string): Promise<Published | null> {
  const uid = await myId(cl)
  if (!uid) return null
  const { data } = await cl.from('public_setups').select('id, racket_id, hidden').eq('user_id', uid).eq('setup_ref', setupRef).maybeSingle()
  return (data as Published | null) ?? null
}

/** A setup's name or signature with an insult in it is not published. */
export class BlockedWordsError extends Error {
  constructor() {
    super('blocked words')
  }
}

/** A recipe hidden by reports cannot be published again: that would undo moderation. */
export class HiddenRecipeError extends Error {
  constructor() {
    super('hidden')
  }
}

/**
 * What publishing a setup again does. Same frame: update the recipe. Another
 * frame: it is another recipe, so the old one goes and a new one starts, with
 * no copies. Hidden by reports: neither.
 */
export function republishPlan(prev: Published | null, racketId: string): 'insert' | 'update' | 'replace' | 'hidden' {
  if (!prev) return 'insert'
  if (prev.hidden) return 'hidden'
  return prev.racket_id === racketId ? 'update' : 'replace'
}

export interface PublishInput {
  name: string
  author?: string
  config: SetupConfig
  racket: Racket
  specs: Specs
  goals: Goal[]
  level?: Level
  style?: Style
  results?: PublicResults | null
  setupRef?: string
}

/** Publishes a saved setup, or updates my earlier copy of it (found by
 *  setupRef). Updates go by id: upsert and per-column grants do not mix. */
export async function publishSetup(p: PublishInput): Promise<'created' | 'updated' | 'moved'> {
  if (hasBlockedWords(p.name) || hasBlockedWords(p.author)) throw new BlockedWordsError()
  const cl = await getCloud()!
  const { racketId, baseMode, measured, accessories, leadG, extra, grip, strings } = p.config
  const { createdAt: _c, updatedAt: _u, ...frame } = p.racket
  const row = {
    name: p.name.trim().slice(0, 60),
    author: p.author?.trim().slice(0, 30) || null,
    config: { racketId, baseMode, measured, accessories, leadG, extra, grip, strings },
    // Custom frames travel with the setup, like a share link.
    racket: p.racket.isStock ? null : frame,
    specs: { weightG: p.specs.weightG, balanceCm: p.specs.balanceCm, swingweight: p.specs.swingweight },
    goals: p.goals.slice(0, 2),
    level: p.level ?? null,
    style: p.style ?? null,
    results: p.results ? roundResults(p.results) : null,
  }
  const prev = p.setupRef ? await published(cl, p.setupRef) : null
  const plan = republishPlan(prev, racketId)
  if (plan === 'hidden') throw new HiddenRecipeError()
  countsCache = undefined
  if (plan === 'update') {
    const { error } = await cl.from('public_setups').update({ ...row, updated_at: new Date().toISOString() }).eq('id', prev!.id)
    if (error) throw error
    return 'updated'
  }
  // The unique (user, setup_ref) means the old row must go before the new one.
  if (plan === 'replace') {
    const { error } = await cl.from('public_setups').delete().eq('id', prev!.id)
    if (error) throw error
  }
  const { error } = await cl.from('public_setups').insert({ ...row, racket_id: racketId, setup_ref: p.setupRef ?? null })
  if (error) throw error
  return plan === 'replace' ? 'moved' : 'created'
}

let countsCache: Promise<Map<string, number>> | undefined

/** Visible published setups per frame, for the library. */
export function setupCounts(): Promise<Map<string, number>> {
  const c = cloud()
  if (!c) return Promise.resolve(new Map())
  countsCache ??= c
    .then((cl) => cl.from('public_setup_counts').select('racket_id, n'))
    .then(({ data }) => new Map((data ?? []).map((r: { racket_id: string; n: number }) => [r.racket_id, r.n])))
    .catch(() => {
      countsCache = undefined
      return new Map<string, number>()
    })
  return countsCache
}

export async function countCopy(id: string) {
  const c = cloud()
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
  countsCache = undefined
  const { error } = await cl.from('public_setups').delete().eq('id', id)
  if (error) throw error
}
