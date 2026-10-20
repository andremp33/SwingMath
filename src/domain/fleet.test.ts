import { describe, expect, it } from 'vitest'
import { addMeasurement, deviation, fleetReferenceId, fleetReport, lightFor, MAX_MEASUREMENTS, needsRemeasure } from './fleet'
import type { Measurement, OwnedRacket, Stringing } from './journal'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 20)

const m = (id: string, daysAgo: number, weightG: number, balanceCm: number, swingweight: number, p: Partial<Measurement> = {}): Measurement => ({
  id,
  date: NOW - daysAgo * DAY,
  weightG,
  balanceCm,
  swingweight,
  strung: true,
  origin: 'pendulum',
  ...p,
})
const racket = (id: string, createdAt: number, measurements?: Measurement[], p: Partial<OwnedRacket> = {}): OwnedRacket => ({
  id,
  name: id,
  racketId: 'stock-x',
  measurements,
  createdAt,
  updatedAt: createdAt,
  ...p,
})

describe('fleet', () => {
  it('lights: within the tolerance green, up to twice it yellow, past it red', () => {
    expect(lightFor(0, 1)).toBe('green')
    expect(lightFor(-1, 1)).toBe('green')
    expect(lightFor(1.5, 1)).toBe('yellow')
    expect(lightFor(-2, 1)).toBe('yellow')
    expect(lightFor(2.5, 1)).toBe('red')
    // A millimetre of balance on the solver's 0.1 cm, whatever the rounding.
    expect(lightFor(32.1 - 32.0, 0.1)).toBe('green')
    expect(lightFor(32.2 - 32.0, 0.1)).toBe('yellow')
  })

  it('deviations are this racket minus the reference; twistweight only when both have it', () => {
    expect(deviation(m('a', 0, 320, 32.4, 325), m('r', 0, 318, 32.0, 322))).toEqual({ weightG: 2, balanceCm: expect.closeTo(0.4, 6), swingweight: 3 })
    expect(deviation(m('a', 0, 320, 32, 325, { twistweight: 14.2 }), m('r', 0, 320, 32, 325, { twistweight: 14 })).twistweight).toBeCloseTo(0.2, 6)
    expect(deviation(m('a', 0, 320, 32, 325, { twistweight: 14.2 }), m('r', 0, 320, 32, 325))).not.toHaveProperty('twistweight')
  })

  it('the reference is the player’s choice, else the highest swingweight; retired and unmeasured rackets never', () => {
    const fleet = [racket('a', 1, [m('a1', 2, 318, 32, 320)]), racket('b', 2, [m('b1', 2, 320, 32, 326)]), racket('c', 3), racket('d', 4, [m('d1', 1, 330, 33, 340)], { retired: true })]
    expect(fleetReferenceId(fleet)).toBe('b')
    expect(fleetReferenceId(fleet, 'a')).toBe('a')
    // Not measured, retired or gone: back to the default.
    expect(fleetReferenceId(fleet, 'c')).toBe('b')
    expect(fleetReferenceId(fleet, 'd')).toBe('b')
    expect(fleetReferenceId(fleet, 'zz')).toBe('b')
    expect(fleetReferenceId([racket('c', 3)])).toBeUndefined()
  })

  it('reports each racket against the reference, with its worst light', () => {
    const fleet = [racket('a', 1, [m('a1', 2, 318, 32.0, 324)]), racket('b', 2, [m('b1', 2, 320, 32.0, 326)]), racket('c', 3, [m('c1', 2, 326, 32.3, 325)])]
    const r = fleetReport(fleet)
    expect(r.reference?.owned.id).toBe('b')
    expect(r.others.map((x) => x.owned.id)).toEqual(['a', 'c'])
    const [a, c] = r.others
    // 2 g lighter is yellow, 2 SW lighter is yellow.
    expect(a.lights).toEqual({ weightG: 'yellow', balanceCm: 'green', swingweight: 'yellow' })
    expect(a.worst).toBe('yellow')
    // 6 g heavier: red.
    expect(c.lights?.weightG).toBe('red')
    expect(c.worst).toBe('red')
  })

  it('a racket measured without strings is not compared with one measured with them', () => {
    const fleet = [racket('a', 1, [m('a1', 2, 300, 31, 300, { strung: false })]), racket('b', 2, [m('b1', 2, 320, 32, 326)])]
    const [a] = fleetReport(fleet).others
    expect(a.comparable).toBe(false)
    expect(a.deviation).toBeUndefined()
    expect(a.worst).toBeUndefined()
  })

  it('a new measurement goes first and moves the fleet', () => {
    const old = m('a1', 10, 318, 32, 320)
    const fresh = m('a2', 0, 320, 32, 326)
    const list = addMeasurement([old], fresh)
    expect(list.map((x) => x.id)).toEqual(['a2', 'a1'])
    // An older one typed in later still sorts by its date.
    expect(addMeasurement(list, m('a0', 20, 310, 31, 310)).map((x) => x.id)).toEqual(['a2', 'a1', 'a0'])
    // Editing one keeps a single copy.
    expect(addMeasurement(list, { ...old, weightG: 319 }).filter((x) => x.id === 'a1')).toHaveLength(1)
    const fleet = [racket('a', 1, [old]), racket('b', 2, [m('b1', 5, 320, 32, 326)])]
    expect(fleetReport(fleet).others[0].lights?.swingweight).toBe('red')
    fleet[0] = { ...fleet[0], measurements: list }
    expect(fleetReport(fleet, 'b').others[0].worst).toBe('green')
  })

  it('keeps the newest measurements only', () => {
    let list: Measurement[] = []
    for (let i = 0; i < MAX_MEASUREMENTS + 5; i++) list = addMeasurement(list, m(`x${i}`, 100 - i, 320, 32, 325))
    expect(list).toHaveLength(MAX_MEASUREMENTS)
    expect(list[0].id).toBe(`x${MAX_MEASUREMENTS + 4}`)
  })

  it('asks to measure again after a restring', () => {
    const o = racket('a', 1, [m('a1', 10, 318, 32, 320)])
    const st = (daysAgo: number): Stringing => ({ id: 's', ownedId: 'a', label: 'a', racketId: 'stock-x', date: NOW - daysAgo * DAY, bed: { mains: { material: 'poly', tensionKg: 23 } }, createdAt: 0, updatedAt: 0 })
    expect(needsRemeasure(o, st(2))).toBe(true)
    expect(needsRemeasure(o, st(12))).toBe(false)
    expect(needsRemeasure(racket('b', 1), st(2))).toBe(false)
  })
})
