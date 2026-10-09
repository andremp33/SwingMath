import { stringLife, type Stringbed, type StringLife } from './strings'

/**
 * The player's journal: each physical racket's stringings, and the sessions
 * played with them. A racket is identified by its label ("Pure Aero #1"):
 * restringing adds a new stringing with the same label.
 */
export interface Stringing {
  id: string
  /** Name of the physical racket, e.g. "Pure Aero #1". */
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
    const prev = latest.get(s.label)
    if (!prev || s.date > prev.date || (s.date === prev.date && s.createdAt > prev.createdAt)) latest.set(s.label, s)
  }
  return [...latest.values()].sort((a, b) => b.date - a.date)
}

/** Rackets whose strings are at or past the end of their life. */
export function dueForRestring(all: Stringing[], sessions: Session[], now = Date.now()) {
  return currentStringings(all).filter((s) => lifeOf(s, sessions, now).used >= 1)
}

export interface StringingInsight {
  stringing: Stringing
  sessions: number
  hours: number
  avg: Partial<Record<SessionRating, number>>
  armPainShare: number
}

/** Averages per stringing, best overall first. Only rated sessions count
 *  towards each average. */
export function insights(all: Stringing[], sessions: Session[]): StringingInsight[] {
  return all
    .map((st) => {
      const mine = sessions.filter((s) => s.stringingId === st.id)
      const avg: Partial<Record<SessionRating, number>> = {}
      for (const k of SESSION_RATINGS) {
        const vals = mine.map((s) => s.ratings[k]).filter((v): v is number => v !== undefined)
        if (vals.length) avg[k] = vals.reduce((a, b) => a + b, 0) / vals.length
      }
      return {
        stringing: st,
        sessions: mine.length,
        hours: mine.reduce((h, s) => h + s.minutes / 60, 0),
        avg,
        armPainShare: mine.length ? mine.filter((s) => s.armPain).length / mine.length : 0,
      }
    })
    .filter((i) => i.sessions > 0)
    .sort((a, b) => (b.avg.overall ?? 0) - (a.avg.overall ?? 0) || b.sessions - a.sessions)
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
