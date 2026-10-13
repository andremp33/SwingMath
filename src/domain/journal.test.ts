import { describe, expect, it } from 'vitest'
import { currentStringings, dueForRestring, hoursOn, insights, latestOf, lifeOf, linkOwned, setupResults, weeklyHours, type OwnedRacket, type Session, type Stringing } from './journal'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 9)

const stringing = (id: string, label: string, daysAgo: number): Stringing => ({
  id,
  label,
  racketId: 'stock-x',
  date: NOW - daysAgo * DAY,
  bed: { mains: { material: 'poly', tensionKg: 23 } },
  createdAt: NOW - daysAgo * DAY,
  updatedAt: 0,
})
const session = (stringingId: string, minutes: number, daysAgo: number, overall?: number, armPain = false): Session => ({
  id: `${stringingId}-${daysAgo}-${minutes}`,
  date: NOW - daysAgo * DAY,
  minutes,
  kind: 'practice',
  stringingId,
  ratings: overall ? { overall } : {},
  armPain,
  createdAt: 0,
  updatedAt: 0,
})

describe('journal', () => {
  const all = [stringing('a1', 'Aero #1', 30), stringing('a2', 'Aero #1', 5), stringing('b1', 'Blade', 10)]
  const sessions = [session('a1', 90, 20, 3), session('a2', 120, 3, 5), session('a2', 60, 1, 4, true), session('b1', 60, 2)]

  it('adds up hours per stringing', () => {
    expect(hoursOn('a2', sessions)).toBe(3)
    expect(hoursOn('zz', sessions)).toBe(0)
  })

  it('keeps only the latest stringing of each racket', () => {
    expect(currentStringings(all).map((s) => s.id)).toEqual(['a2', 'b1'])
  })

  it('life uses the hours and days of that stringing only', () => {
    const l = lifeOf(all[1], sessions, NOW)
    expect(l.hours).toBe(3)
    expect(l.days).toBeCloseTo(5, 6)
    expect(l.used).toBeGreaterThan(0)
    expect(l.used).toBeLessThan(1)
  })

  it('flags rackets past their strings’ life', () => {
    const heavy = [...sessions, session('b1', 18 * 60, 1)]
    expect(dueForRestring(all, heavy, NOW).map((s) => s.id)).toEqual(['b1'])
  })

  it('ranks stringings by average overall rating', () => {
    const r = insights(all, sessions)
    expect(r[0].stringing.id).toBe('a2')
    expect(r[0].avg.overall).toBe(4.5)
    expect(r[0].armPainShare).toBe(0.5)
    expect(r.find((i) => i.stringing.id === 'b1')?.avg.overall).toBeUndefined()
  })

  it('buckets hours by week, oldest first', () => {
    const w = weeklyHours(sessions, 4, NOW)
    expect(w).toEqual([0, 1.5, 0, 4])
  })
})

describe('owned rackets', () => {
  const old = [stringing('a1', 'Aero #1', 30), stringing('a2', ' aero #1 ', 5), stringing('b1', 'Blade', 10)]
  let k = 0
  const newId = () => `o${++k}`

  it('older journals get one owned racket per name, case and spaces aside', () => {
    const { created, linked } = linkOwned(old, [], newId, NOW)
    expect(created.map((o) => o.name).sort()).toEqual(['Blade', 'aero #1'])
    const aero = created.find((o) => o.name === 'aero #1')!
    expect(linked.filter((s) => s.ownedId === aero.id).map((s) => s.id).sort()).toEqual(['a1', 'a2'])
    // The latest stringing names it and gives it its frame.
    expect(aero.racketId).toBe('stock-x')
  })

  it('an existing racket with that name is reused', () => {
    const mine: OwnedRacket = { id: 'mine', name: 'Blade', racketId: 'stock-y', createdAt: 0, updatedAt: 0 }
    const { created, linked } = linkOwned(old, [mine], newId, NOW)
    expect(created.some((o) => o.name === 'Blade')).toBe(false)
    expect(linked.find((s) => s.id === 'b1')?.ownedId).toBe('mine')
  })

  it('each owned racket counts as one, whatever its stringings were called', () => {
    const renamed = [{ ...stringing('x1', 'Old name', 9), ownedId: 'r' }, { ...stringing('x2', 'New name', 2), ownedId: 'r' }]
    expect(currentStringings(renamed).map((s) => s.id)).toEqual(['x2'])
    expect(latestOf('r', renamed)?.id).toBe('x2')
  })
})

describe('setup results', () => {
  const owned: OwnedRacket[] = [
    { id: 'o1', name: 'Aero de jogo', racketId: 'stock-x', setupId: 'torneio', createdAt: 0, updatedAt: 0 },
    { id: 'o2', name: 'Aero treino', racketId: 'stock-x', createdAt: 0, updatedAt: 0 },
  ]
  // Named on the stringing, through the racket, and on a racket built to something else.
  const st = [
    { ...stringing('direct', 'x', 20), setupId: 'torneio' },
    { ...stringing('via-racket', 'x', 10), ownedId: 'o1' },
    { ...stringing('other', 'x', 5), ownedId: 'o2' },
    { ...stringing('named-elsewhere', 'x', 4), ownedId: 'o1', setupId: 'leve' },
  ]

  it('links sessions by the stringing’s setup, or by its racket’s', () => {
    const s = [session('direct', 60, 15, 4), session('via-racket', 90, 8, 5), session('via-racket', 30, 7), session('other', 60, 3, 1), session('named-elsewhere', 60, 2, 1)]
    const r = setupResults('torneio', owned, st, s)
    expect(r).toEqual({ sessions: 3, hours: 3, avg: { overall: 4.5 } })
  })

  it('needs at least 3 sessions', () => {
    expect(setupResults('torneio', owned, st, [session('direct', 60, 15, 4), session('via-racket', 60, 8, 5)])).toBeNull()
    expect(setupResults('nothing', owned, st, [])).toBeNull()
  })

  it('never carries arm pain', () => {
    const s = [session('direct', 60, 15, 4, true), session('direct', 60, 14, 4, true), session('direct', 60, 13, 4)]
    expect(setupResults('torneio', owned, st, s)).not.toHaveProperty('armPainShare')
  })
})
