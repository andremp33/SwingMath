import { lifeLimits, stringLife, type Stringbed, type StringLife, type StringSpec } from './strings'
import type { ExtraLead, LeadMap } from './types'

/**
 * The player's journal: their own rackets (the physical frames they play
 * with), each racket's stringings, and the sessions played with them.
 */

/** A racket the player owns: "Pure Aero #1", a frame model, and the setup
 *  it is built to. Restringing adds a stringing to it. */
export interface OwnedRacket {
  id: string
  name: string
  /** Frame model (stock or custom racket id). */
  racketId: string
  /** Saved setup this racket is built to, if any. */
  setupId?: string
  notes?: string
  /** Put away: kept with its history, out of the way. */
  retired?: boolean
  /** What it weighed and swung, newest first (at most MAX_MEASUREMENTS). */
  measurements?: Measurement[]
  /** The lead on it now, as the player saved it from a plan. */
  lead?: { leadG: LeadMap; extra?: ExtraLead[] }
  createdAt: number
  updatedAt: number
}

export const MEASURE_ORIGINS = ['pendulum', 'shop', 'manual'] as const
export type MeasureOrigin = (typeof MEASURE_ORIGINS)[number]

/** One measurement of an owned racket, as it was that day. */
export interface Measurement {
  id: string
  date: number
  weightG: number
  balanceCm: number
  swingweight: number
  twistweight?: number
  /** With its strings on. */
  strung: boolean
  /** The app's pendulum, a shop's machine (RDC), or numbers typed in. */
  origin: MeasureOrigin
}

export interface Stringing {
  id: string
  /** The owned racket it was strung on. Older journals only had `label`. */
  ownedId?: string
  /** The racket's name when it was strung (kept for older versions). */
  label: string
  /** Frame model (stock or custom racket id). */
  racketId: string
  /** Saved setup this racket is built to, if any. */
  setupId?: string
  /** Day it was strung (ms). */
  date: number
  bed: Stringbed
  /** The player's own string life in hours, overriding the material's. */
  lifeHours?: number
  /** How these strings played overall, 1-5: asked when they are replaced,
   *  so a ranking needs no rated sessions. */
  rating?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export const SESSION_KINDS = ['practice', 'match', 'lesson', 'serve'] as const
export type SessionKind = (typeof SESSION_KINDS)[number]

export const SESSION_RATINGS = ['overall', 'power', 'control', 'spin', 'comfort'] as const
export type SessionRating = (typeof SESSION_RATINGS)[number]

export interface Session {
  id: string
  date: number
  minutes: number
  kind: SessionKind
  stringingId?: string
  /** 1-5 each, all optional. */
  ratings: Partial<Record<SessionRating, number>>
  armPain?: boolean
  notes?: string
  createdAt: number
  updatedAt: number
}

const DAY = 86_400_000

export function hoursOn(stringingId: string, sessions: Session[]) {
  return sessions.reduce((h, s) => (s.stringingId === stringingId ? h + s.minutes / 60 : h), 0)
}

/** A stringing's life so far. With the player's other stringings, how long
 *  their strings of the same material lasted counts (lifeHoursFor). */
export function lifeOf(st: Stringing, sessions: Session[], now = Date.now(), all: Stringing[] = []): StringLife & { hours: number; days: number } {
  const hours = hoursOn(st.id, sessions)
  const days = Math.max(0, (now - st.date) / DAY)
  return { ...stringLife(st.bed, hours, days, lifeHoursFor(st, all, sessions)), hours, days }
}

/** The latest stringing of each racket, newest racket first. */
export function currentStringings(all: Stringing[]): Stringing[] {
  const latest = new Map<string, Stringing>()
  for (const s of all) {
    const k = ownerKey(s)
    const prev = latest.get(k)
    if (!prev || s.date > prev.date || (s.date === prev.date && s.createdAt > prev.createdAt)) latest.set(k, s)
  }
  return [...latest.values()].sort((a, b) => b.date - a.date)
}

/** Which racket a stringing belongs to: its owned racket, or (older
 *  journals) its label. */
export const ownerKey = (s: Stringing) => s.ownedId ?? `label:${s.label.trim().toLowerCase()}`

/** The latest stringing of one owned racket. */
export function latestOf(ownedId: string, all: Stringing[]): Stringing | undefined {
  return currentStringings(all.filter((s) => s.ownedId === ownedId))[0]
}

/**
 * Older journals named rackets on each stringing. Gives every unlinked
 * stringing an owned racket: one per name (an existing racket with that
 * name, or a new one built from its latest stringing).
 */
export function linkOwned(stringings: Stringing[], owned: OwnedRacket[], newId: () => string, now = Date.now()) {
  const byName = new Map(owned.map((o) => [o.name.trim().toLowerCase(), o]))
  const created: OwnedRacket[] = []
  const linked: Stringing[] = []
  const loose = stringings.filter((s) => !s.ownedId).sort((a, b) => b.date - a.date)
  for (const s of loose) {
    const name = s.label.trim()
    let o = byName.get(name.toLowerCase())
    if (!o) {
      o = { id: newId(), name, racketId: s.racketId, setupId: s.setupId, createdAt: s.createdAt, updatedAt: now }
      byName.set(name.toLowerCase(), o)
      created.push(o)
    }
    linked.push({ ...s, ownedId: o.id, updatedAt: now })
  }
  return { created, linked }
}

/**
 * When a stringing's life runs out, in ms: its weeks on the racket or its
 * playing hours, whichever comes first. The hours run at the pace of the
 * sessions logged on it (over at least a week, so one long first session
 * does not race the date); with none logged yet, at the player's own
 * estimate of hours a week. Neither: the weeks alone. The hours are the
 * player's own (set on the stringing), else how long their strings of that
 * material lasted, else the material's.
 */
export function restringDue(st: Stringing, sessions: Session[], hoursPerWeek?: number, now = Date.now(), all: Stringing[] = []): number {
  const { hours: life, weeks } = lifeLimits(st.bed, lifeHoursFor(st, all, sessions))
  const byTime = st.date + weeks * 7 * DAY
  const mine = sessions.filter((s) => s.stringingId === st.id)
  const played = mine.reduce((h, s) => h + s.minutes / 60, 0)
  const days = Math.max(7, (now - st.date) / DAY)
  const perDay = mine.length ? played / days : (hoursPerWeek ?? 0) / 7
  if (perDay <= 0) return byTime
  const byHours = mine.length ? now + (Math.max(0, life - played) / perDay) * DAY : st.date + (life / perDay) * DAY
  return Math.min(byTime, byHours)
}

/** Days without a session on a racket, while others are played, before
 *  it counts as put away for now. */
export const DORMANT_DAYS = 60

/**
 * A racket the player has stopped playing: they log sessions, but none on
 * it (nor a new stringing) in DORMANT_DAYS. Its strings still age on the
 * calendar, but reminding them to restring it is noise.
 */
export function isDormant(ownedId: string, all: Stringing[], sessions: Session[], now = Date.now()): boolean {
  const since = now - DORMANT_DAYS * DAY
  const recent = sessions.filter((s) => s.date >= since)
  if (!recent.length) return false
  const mine = all.filter((s) => s.ownedId === ownedId)
  if (mine.some((s) => s.date >= since)) return false
  const ids = new Set(mine.map((s) => s.id))
  return !recent.some((s) => s.stringingId && ids.has(s.stringingId))
}

/** Rackets whose strings are at or past the end of their life. */
export function dueForRestring(all: Stringing[], sessions: Session[], now = Date.now()) {
  return currentStringings(all).filter((s) => lifeOf(s, sessions, now, all).used >= 1)
}

export interface StringingInsight extends SessionSummary {
  /** The latest of `stringings`. */
  stringing: Stringing
  /** The same named strings at the same tension count as one; otherwise
   *  one stringing. */
  stringings: Stringing[]
  /** Too few sessions, or too close to a neighbour, to call it better. */
  noise: boolean
}

/** Fewer sessions than this, or a gap smaller than NOISE_GAP, and a
 *  ranking is still noise. */
export const NOISE_SESSIONS = 3
export const NOISE_GAP = 0.3

export interface InsightOptions {
  /** Only sessions of this kind. */
  kind?: SessionKind
  /** Only sessions played while the strings were alive: dead strings say
   *  nothing about the strings. */
  withinLife?: boolean
}

/** What a set of sessions adds up to. Only rated sessions count towards
 *  each average. */
export interface SessionSummary {
  sessions: number
  hours: number
  avg: Partial<Record<SessionRating, number>>
  armPainShare: number
}

export function summariseSessions(list: Session[]): SessionSummary {
  const avg: Partial<Record<SessionRating, number>> = {}
  for (const k of SESSION_RATINGS) {
    const vals = list.map((s) => s.ratings[k]).filter((v): v is number => v !== undefined)
    if (vals.length) avg[k] = vals.reduce((a, b) => a + b, 0) / vals.length
  }
  return {
    sessions: list.length,
    hours: list.reduce((h, s) => h + s.minutes / 60, 0),
    avg,
    armPainShare: list.length ? list.filter((s) => s.armPain).length / list.length : 0,
  }
}

/** Which stringings are the same strings: named strings at the same
 *  tension, whatever the racket. Strings without a name stay on their own. */
export function bedKey(st: Stringing): string {
  const one = (s: StringSpec) => (s.name?.trim() ? `${s.name.trim().toLowerCase().replace(/\s+/g, ' ')}@${s.tensionKg}` : `${s.material}@${s.tensionKg}`)
  const { mains, crosses } = st.bed
  return mains.name?.trim() || crosses?.name?.trim() ? `${one(mains)}|${crosses ? one(crosses) : ''}` : `id:${st.id}`
}

/** Averages per string (see bedKey), best overall first. Only rated
 *  sessions count towards each average; the rating a stringing was given
 *  when it was replaced counts as one more overall (not by kind: it was
 *  not one kind of session). A row
 *  of such ratings alone is not noise for want of sessions: the player
 *  judged the whole stringing. */
export function insights(all: Stringing[], sessions: Session[], { kind, withinLife }: InsightOptions = {}): StringingInsight[] {
  const groups = new Map<string, Stringing[]>()
  for (const st of all) groups.set(bedKey(st), [...(groups.get(bedKey(st)) ?? []), st])
  const counted = (st: Stringing) => {
    const life = withinLife ? lifeLimits(st.bed, lifeHoursFor(st, all, sessions)).hours : Infinity
    return sessionsWithAge(st.id, sessions)
      .filter((x) => x.atHours < life && (!kind || x.session.kind === kind))
      .map((x) => x.session)
  }
  const rows = [...groups.values()]
    .map((list) => {
      const latest = list.reduce((a, b) => (b.date > a.date ? b : a))
      const played = list.flatMap(counted)
      const summary = summariseSessions(played)
      const judged = kind ? [] : list.map((st) => st.rating).filter((v): v is number => v !== undefined)
      const overalls = [...played.map((s) => s.ratings.overall).filter((v): v is number => v !== undefined), ...judged]
      const avg = overalls.length ? { ...summary.avg, overall: overalls.reduce((a, b) => a + b, 0) / overalls.length } : summary.avg
      return { stringing: latest, stringings: list, noise: false, judged: judged.length > 0, ...summary, avg }
    })
    .filter((i) => i.sessions > 0 || i.judged)
    .sort((a, b) => (b.avg.overall ?? 0) - (a.avg.overall ?? 0) || b.sessions - a.sessions)
  const near = (a: StringingInsight, b?: StringingInsight) =>
    !!b && a.avg.overall !== undefined && b.avg.overall !== undefined && Math.abs(a.avg.overall - b.avg.overall) < NOISE_GAP
  return rows.map(({ judged, ...r }, i) => ({ ...r, noise: (r.sessions < NOISE_SESSIONS && !judged) || near(r, rows[i - 1]) || near(r, rows[i + 1]) }))
}

/** How a session played, 1-5: its overall rating, else the mean of power,
 *  control and spin. Undefined when none of them is rated. */
export function sessionScore(s: Session): number | undefined {
  if (s.ratings.overall !== undefined) return s.ratings.overall
  const parts = (['power', 'control', 'spin'] as const).map((k) => s.ratings[k]).filter((v): v is number => v !== undefined)
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : undefined
}

/** One stringing's sessions in the order played, each with the hours the
 *  strings had when it started. */
export function sessionsWithAge(stringingId: string, sessions: Session[]) {
  const mine = sessions.filter((s) => s.stringingId === stringingId).sort((a, b) => a.date - b.date || a.createdAt - b.createdAt)
  let h = 0
  return mine.map((session) => {
    const atHours = h
    h += session.minutes / 60
    return { session, atHours }
  })
}

/** Hours of play in each block of a stringing's report. */
export const REPORT_BLOCK_HOURS = 3
/** A block this much below the first (out of 5) is strings gone dead. */
export const DEATH_DROP = 0.7
/** Fewer rated sessions than this in a block say nothing about it. */
const MIN_BLOCK_SESSIONS = 2

export interface ReportBlock {
  /** Hours on the strings where the block starts. */
  fromHours: number
  sessions: number
  /** Mean score of its rated sessions (sessionScore). */
  score?: number
}

export interface StringingReport extends SessionSummary {
  /** Every REPORT_BLOCK_HOURS of play, first to last. */
  blocks: ReportBlock[]
  /** Hours on the strings when they went dead, if they did. */
  deathHours?: number
  /** The hours the strings had in each session with arm pain. */
  armPainAtHours: number[]
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined)

/**
 * What a stringing's life looked like: hours, sessions, averages, how it
 * played every 3 hours, and where it went dead: the first block scoring
 * DEATH_DROP or more below the first one, both with at least two rated
 * sessions.
 */
export function stringingReport(st: Stringing, sessions: Session[]): StringingReport {
  const aged = sessionsWithAge(st.id, sessions)
  const blocks: { fromHours: number; sessions: number; scores: number[] }[] = []
  for (const { session, atHours } of aged) {
    const i = Math.floor(atHours / REPORT_BLOCK_HOURS)
    while (blocks.length <= i) blocks.push({ fromHours: blocks.length * REPORT_BLOCK_HOURS, sessions: 0, scores: [] })
    blocks[i].sessions++
    const score = sessionScore(session)
    if (score !== undefined) blocks[i].scores.push(score)
  }
  const [first, ...rest] = blocks
  const dead =
    first && first.scores.length >= MIN_BLOCK_SESSIONS
      ? rest.find((b) => b.scores.length >= MIN_BLOCK_SESSIONS && mean(first.scores)! - mean(b.scores)! >= DEATH_DROP - 1e-9)
      : undefined
  return {
    ...summariseSessions(aged.map((x) => x.session)),
    blocks: blocks.map((b) => ({ fromHours: b.fromHours, sessions: b.sessions, score: mean(b.scores) })),
    deathHours: dead?.fromHours,
    armPainAtHours: aged.filter((x) => x.session.armPain).map((x) => x.atHours),
  }
}

/** A stringing is finished once its racket has been strung again. */
export const isFinished = (st: Stringing, all: Stringing[]) =>
  all.some((o) => o.id !== st.id && ownerKey(o) === ownerKey(st) && (o.date > st.date || (o.date === st.date && o.createdAt > st.createdAt)))

/** The materials of a stringbed, mains then crosses: what sets how long it lasts. */
export const materialKey = (bed: Stringbed) =>
  bed.crosses && bed.crosses.material !== bed.mains.material ? `${bed.mains.material}/${bed.crosses.material}` : bed.mains.material

/**
 * How many hours the player's own strings of this material last: the median
 * of where their finished stringings of it went dead. Undefined until one
 * has.
 */
export function personalLife(bed: Stringbed, all: Stringing[], sessions: Session[]): number | undefined {
  const key = materialKey(bed)
  const deaths = all
    .filter((st) => materialKey(st.bed) === key && isFinished(st, all))
    .map((st) => stringingReport(st, sessions).deathHours)
    .filter((h): h is number => h !== undefined)
    .sort((a, b) => a - b)
  if (!deaths.length) return undefined
  const m = deaths.length >> 1
  return deaths.length % 2 ? deaths[m] : (deaths[m - 1] + deaths[m]) / 2
}

/** The hours a stringing should last: the player's own, else their
 *  personal life for the material; undefined leaves the material's. */
export const lifeHoursFor = (st: Stringing, all: Stringing[], sessions: Session[]) => st.lifeHours ?? personalLife(st.bed, all, sessions)

export interface NextStringing {
  /** Mains tension for the next stringing (the crosses keep their gap). */
  tensionKg: number
  why: 'keep' | 'best' | 'armPain' | 'noData'
  /** Share of the sessions at that tension with arm pain, for 'armPain'. */
  armPainShare: number
  /** Hours to play it before restringing. */
  changeAtHours: number
}

/** The same strings, whatever the tension: their names, else materials. */
const stringsKey = (bed: Stringbed) =>
  [bed.mains, bed.crosses ?? bed.mains].map((s) => s.name?.trim().toLowerCase().replace(/\s+/g, ' ') || s.material).join('|')

/**
 * What to string next on this racket, from its stringings of the same
 * strings. The tension stays, unless two or more tensions have at least
 * NOISE_SESSIONS rated sessions each (then the best rated one), or the arm
 * hurt in a quarter or more of the sessions at it, and more than at any
 * other tension (then a kilo less). Only sessions on live strings count.
 */
export function nextStringing(st: Stringing, all: Stringing[], sessions: Session[]): NextStringing {
  const same = all.filter((o) => ownerKey(o) === ownerKey(st) && stringsKey(o.bed) === stringsKey(st.bed))
  const byKg = new Map<number, { scores: number[]; n: number; pain: number }>()
  for (const o of same) {
    const life = lifeLimits(o.bed, lifeHoursFor(o, all, sessions)).hours
    for (const { session, atHours } of sessionsWithAge(o.id, sessions)) {
      if (atHours >= life) continue
      const g = byKg.get(o.bed.mains.tensionKg) ?? { scores: [], n: 0, pain: 0 }
      g.n++
      if (session.armPain) g.pain++
      const score = sessionScore(session)
      if (score !== undefined) g.scores.push(score)
      byKg.set(o.bed.mains.tensionKg, g)
    }
  }
  const tried = [...byKg].filter(([, g]) => g.scores.length >= NOISE_SESSIONS).sort((a, b) => mean(b[1].scores)! - mean(a[1].scores)!)
  const current = st.bed.mains.tensionKg
  let kg = tried.length >= 2 ? tried[0][0] : current
  let why: NextStringing['why'] = kg !== current ? 'best' : (byKg.get(current)?.n ?? 0) >= NOISE_SESSIONS ? 'keep' : 'noData'
  const share = (g?: { n: number; pain: number }) => (g?.n ? g.pain / g.n : 0)
  const here = byKg.get(kg)
  const elsewhere = Math.max(0, ...[...byKg].filter(([k]) => k !== kg).map(([, g]) => share(g)))
  const pain = share(here)
  if (here && here.n >= NOISE_SESSIONS && pain >= 0.25 && pain > elsewhere) {
    kg -= 1
    why = 'armPain'
  }
  return { tensionKg: kg, why, armPainShare: pain, changeAtHours: Math.round(lifeLimits(st.bed, lifeHoursFor(st, all, sessions)).hours) }
}

/** Fewer sessions than this say nothing about a setup. */
export const MIN_RESULT_SESSIONS = 3

/**
 * How a saved setup played: the sessions on stringings built to it. A
 * stringing counts when it names the setup, or, naming none, when its
 * racket is built to it. Null below MIN_RESULT_SESSIONS. Arm pain is left
 * out: it is health data and never leaves the device with this.
 */
export function setupResults(setupId: string, owned: OwnedRacket[], stringings: Stringing[], sessions: Session[]) {
  const builtTo = new Set(owned.filter((o) => o.setupId === setupId).map((o) => o.id))
  const ids = new Set(stringings.filter((st) => (st.setupId ? st.setupId === setupId : !!st.ownedId && builtTo.has(st.ownedId))).map((st) => st.id))
  const { sessions: n, hours, avg } = summariseSessions(sessions.filter((s) => s.stringingId && ids.has(s.stringingId)))
  return n < MIN_RESULT_SESSIONS ? null : { sessions: n, hours, avg }
}

/** Hours played per week over the last `weeks` weeks, oldest first. */
export function weeklyHours(sessions: Session[], weeks = 8, now = Date.now()) {
  const out = Array.from({ length: weeks }, () => 0)
  for (const s of sessions) {
    const ago = Math.floor((now - s.date) / (7 * DAY))
    if (ago >= 0 && ago < weeks) out[weeks - 1 - ago] += s.minutes / 60
  }
  return out
}
