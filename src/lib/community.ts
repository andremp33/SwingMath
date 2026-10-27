import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { racketSchema, setupSchema } from '../data/db'
import { SESSION_RATINGS, type SessionRating } from '../domain/journal'
import type { Racket, SetupConfig, Specs } from '../domain/types'
import { cloudConfigured, getCloud } from './cloud'
import { hasBlockedWords } from './wordFilter'

/** Community data: medians of frames players measured, and setups they
 *  published. Reading needs no account; writing does. Recipes are read
 *  through the community_setups view, which never shows who wrote them. */

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
  /** The author, as an opaque key: enough to hide them, nothing more. */
  author_key: string
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
  /** Mine, and hidden by reports (only my own hidden recipes reach me). */
  mine: boolean
  hidden: boolean
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
  author_key: z.string(),
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
  mine: z.boolean().default(false),
  hidden: z.boolean().default(false),
})

/** Keeps the rows that pass the schema; drops the rest without a fuss. */
export function parsePublicSetups(rows: unknown[]): PublicSetup[] {
  return rows.flatMap((r) => {
    const p = rowSchema.safeParse(r)
    return p.success ? [p.data as PublicSetup] : []
  })
}

const COLUMNS = 'id, author_key, racket_id, name, author, config, racket, specs, copies, created_at, goals, level, style, results, setup_ref, partner, updated_at, mine, hidden'

/** How many recipes per frame the app asks for, in the order it shows. */
const FETCHED = 100
/** How many of the most saved recipes, on any frame, for similar frames. */
const TOP = 200

/** Recipes for these frames (a frame and its other versions), in the
 *  order rankPublicSetups gives, so a recipe many saved is never pushed
 *  out by newer ones. */
export async function publicSetups(racketIds: string[]): Promise<PublicSetup[]> {
  const c = cloud()
  if (!c || !racketIds.length) return []
  const { data } = await (await c)
    .from('community_setups')
    .select(COLUMNS)
    .in('racket_id', racketIds)
    .order('partner', { ascending: false, nullsFirst: false })
    .order('copies', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(FETCHED)
  return parsePublicSetups(data ?? [])
}

let topCache: Promise<PublicSetup[]> | undefined

/** The most saved recipes on any frame: where similar frames' recipes come
 *  from while a frame has none of its own. */
export function topSetups(): Promise<PublicSetup[]> {
  const c = cloud()
  if (!c) return Promise.resolve([])
  topCache ??= c
    .then((cl) => cl.from('community_setups').select(COLUMNS).order('copies', { ascending: false }).order('created_at', { ascending: false }).limit(TOP))
    .then(({ data }) => parsePublicSetups(data ?? []))
    .catch(() => {
      topCache = undefined
      return []
    })
  return topCache
}

/** Library frames that are other versions of this one: the same brand and
 *  model, another year. */
export function siblingsOf(racket: Pick<Racket, 'id' | 'brand' | 'model' | 'isStock'>, stock: Pick<Racket, 'id' | 'brand' | 'model'>[]): string[] {
  if (!racket.isStock) return []
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  return stock.filter((r) => r.id !== racket.id && same(r.brand, racket.brand) && same(r.model, racket.model)).map((r) => r.id)
}

type FrameSpecs = Pick<Racket, 'weightG' | 'balanceCm' | 'swingweight'>

/** How far apart two frames feel: 10 g, 5 mm of balance or 10 of swingweight
 *  each count as one. */
export function frameDistance(a: FrameSpecs, b: FrameSpecs): number {
  return Math.abs(a.weightG - b.weightG) / 10 + Math.abs(a.balanceCm - b.balanceCm) / 0.5 + Math.abs(a.swingweight - b.swingweight) / 10
}

/** Frames this close count as similar. */
export const SIMILAR_WITHIN = 2.5

/**
 * Recipes on other frames that feel like this one, closest first: a start
 * for a frame nobody has published for yet. `frameOf` finds a recipe's frame
 * (from the library, or the custom frame it carries).
 */
export function similarRecipes(list: PublicSetup[], racket: Racket, skip: string[], frameOf: (p: PublicSetup) => FrameSpecs | undefined, n = 5): PublicSetup[] {
  return list
    .filter((p) => p.racket_id !== racket.id && !skip.includes(p.racket_id))
    .flatMap((p) => {
      const f = frameOf(p)
      const d = f && frameDistance(f, racket)
      return d !== undefined && d <= SIMILAR_WITHIN ? [{ p, d }] : []
    })
    .sort((a, b) => a.d - b.d || b.p.copies - a.p.copies)
    .slice(0, n)
    .map((x) => x.p)
}

/** Filters a list by goal, level and style; an unset filter keeps all. */
export function filterRecipes(list: PublicSetup[], f: { goal?: Goal; level?: Level; style?: Style }): PublicSetup[] {
  return list.filter((p) => (!f.goal || p.goals.includes(f.goal)) && (!f.level || p.level === f.level) && (!f.style || p.style === f.style))
}

/**
 * The order players see: partner shops first, then recipes for this very
 * frame before its other versions, then the recipes most players saved,
 * then the newest. Journal results are shown, never ranked: they are the
 * author's own ratings of their own recipe.
 */
export function rankPublicSetups(list: PublicSetup[], goal?: Goal, racketId?: string): PublicSetup[] {
  const here = (p: PublicSetup) => Number(!racketId || p.racket_id === racketId)
  return list
    .filter((p) => !goal || p.goals.includes(goal))
    .sort(
      (a, b) =>
        Number(!!b.partner) - Number(!!a.partner) || here(b) - here(a) || b.copies - a.copies || Date.parse(b.created_at) - Date.parse(a.created_at),
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

/** My published copy of a saved setup, if there is one (hidden or not). */
export async function myRecipe(setupRef: string): Promise<PublicSetup | null> {
  const c = cloud()
  if (!c) return null
  const cl = await c
  if (!(await myId(cl))) return null
  const { data } = await cl.from('community_setups').select(COLUMNS).eq('mine', true).eq('setup_ref', setupRef).maybeSingle()
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
  topCache = undefined
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

/** A player saved a recipe as a setup of their own: one copy, once per
 *  account (count_copy). Trying one on does not count. */
export async function countCopy(id: string) {
  const c = cloud()
  if (c) await (await c).rpc('count_copy', { setup_id: id })
}

/** Why a player reports a recipe, as the moderation queue lists it. */
export const REPORT_REASONS = ['offensive', 'false', 'spam'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export async function reportSetup(id: string, reason: ReportReason) {
  const cl = await getCloud()!
  const { error } = await cl.from('reports').insert({ setup_id: id, reason })
  // Reporting twice is fine.
  if (error && error.code !== '23505') throw error
}

export async function deletePublicSetup(id: string) {
  const cl = await getCloud()!
  countsCache = undefined
  const { error } = await cl.from('public_setups').delete().eq('id', id)
  if (error) throw error
}
