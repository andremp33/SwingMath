import { describe, expect, it } from 'vitest'
import { currentStringings, dueForRestring, hoursOn, insights, lifeOf, weeklyHours, type Session, type Stringing } from './journal'

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
