import { lifeLimits, stringLife, type Stringbed, type StringLife, type StringSpec } from './strings'

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
  createdAt: number
  updatedAt: number
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

export function lifeOf(st: Stringing, sessions: Session[], now = Date.now()): StringLife & { hours: number; days: number } {
  const hours = hoursOn(st.id, sessions)
  const days = Math.max(0, (now - st.date) / DAY)
  return { ...stringLife(st.bed, hours, days, st.lifeHours), hours, days }
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
 * estimate of hours a week. Neither: the weeks alone.
 */
export function restringDue(st: Stringing, sessions: Session[], hoursPerWeek?: number, now = Date.now()): number {
  const { hours: life, weeks } = lifeLimits(st.bed, st.lifeHours)
  const byTime = st.date + weeks * 7 * DAY
  const mine = sessions.filter((s) => s.stringingId === st.id)
  const played = mine.reduce((h, s) => h + s.minutes / 60, 0)
  const days = Math.max(7, (now - st.date) / DAY)
  const perDay = mine.length ? played / days : (hoursPerWeek ?? 0) / 7
  if (perDay <= 0) return byTime
  const byHours = mine.length ? now + (Math.max(0, life - played) / perDay) * DAY : st.date + (life / perDay) * DAY
  return Math.min(byTime, byHours)
}

/** Rackets whose strings are at or past the end of their life. */
export function dueForRestring(all: Stringing[], sessions: Session[], now = Date.now()) {
  return currentStringings(all).filter((s) => lifeOf(s, sessions, now).used >= 1)
}

export interface StringingInsight extends SessionSummary {
  /** The latest of `stringings`. */
  stringing: Stringing
  /** The same named strings at the same tension count as one; otherwise
   *  one stringing. */
  stringings: Stringing[]
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
 *  sessions count towards each average. */
export function insights(all: Stringing[], sessions: Session[]): StringingInsight[] {
  const groups = new Map<string, Stringing[]>()
  for (const st of all) groups.set(bedKey(st), [...(groups.get(bedKey(st)) ?? []), st])
  return [...groups.values()]
    .map((list) => {
      const ids = new Set(list.map((st) => st.id))
      const latest = list.reduce((a, b) => (b.date > a.date ? b : a))
      return { stringing: latest, stringings: list, ...summariseSessions(sessions.filter((s) => s.stringingId && ids.has(s.stringingId))) }
    })
    .filter((i) => i.sessions > 0)
    .sort((a, b) => (b.avg.overall ?? 0) - (a.avg.overall ?? 0) || b.sessions - a.sessions)
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
