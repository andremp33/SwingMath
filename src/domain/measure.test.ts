import { describe, expect, it } from 'vitest'
import { oddTrials, periodFromSwingweight, swingweightError, swingweightFromPeriod } from './measure'

describe('pendulum swingweight', () => {
  it('matches the physical pendulum formula by hand', () => {
    // 330 g, balance 32.5 cm, pivot at 10 cm: d = 0.225 m.
    const T = 1.3
    const byHand = ((0.33 * 9.80665 * 0.225 * T * T) / (4 * Math.PI ** 2)) * 1e4
    expect(swingweightFromPeriod(330, 32.5, T)).toBeCloseTo(byHand, 6)
  })

  it('round-trips through the period', () => {
    const T = periodFromSwingweight(330, 32.5, 320)
    expect(T).toBeGreaterThan(1.2)
    expect(T).toBeLessThan(1.45)
    expect(swingweightFromPeriod(330, 32.5, T)).toBeCloseTo(320, 6)
  })

  it('gives the same swingweight from a different pivot point', () => {
    const T = periodFromSwingweight(330, 32.5, 320, 8)
    expect(swingweightFromPeriod(330, 32.5, T, 8)).toBeCloseTo(320, 6)
  })

  it('the error: balance weighs most, and the total is about ±3 to ±4', () => {
    // A typical racket and the steps on screen: pivot at 10 cm, 20 swings, 3 times.
    const T = periodFromSwingweight(320, 32, 320)
    const e = swingweightError({ weightG: 320, balanceCm: 32, pivotCm: 10, periodS: T, swings: 20, trials: 3 })
    expect(e.balance).toBeGreaterThan(e.timing)
    expect(e.balance).toBeGreaterThan(e.weight)
    // ±2 mm of balance over d = 22 cm: about ±0.9 %, ±2.9 SW.
    expect(e.balance).toBeCloseTo((320 * 0.2) / 22, 1)
    expect(e.total).toBeGreaterThan(3)
    expect(e.total).toBeLessThan(4)
    expect(e.total).toBeCloseTo(Math.hypot(e.timing, e.balance, e.weight), 9)
  })

  it('more swings and more trials shrink the timing part only', () => {
    const T = periodFromSwingweight(320, 32, 320)
    const base = { weightG: 320, balanceCm: 32, pivotCm: 10, periodS: T }
    const few = swingweightError({ ...base, swings: 10, trials: 1 })
    const many = swingweightError({ ...base, swings: 30, trials: 3 })
    expect(many.timing).toBeLessThan(few.timing)
    expect(many.balance).toBeCloseTo(few.balance, 9)
    // A better balance point is what helps most.
    expect(swingweightError({ ...base, swings: 20, trials: 3, balanceErrMm: 1 }).total).toBeLessThan(many.total)
  })

  it('works from any pivot', () => {
    const T = periodFromSwingweight(330, 32.5, 320, 8)
    const e = swingweightError({ weightG: 330, balanceCm: 32.5, pivotCm: 8, periodS: T, swings: 20, trials: 3 })
    expect(e.total).toBeGreaterThan(2)
    expect(e.total).toBeLessThan(5)
  })

  it('a trial miscounted by one swing stands out', () => {
    const T = 1.35
    // 20 swings counted as 21 in the third trial.
    const periods = [T, T * 1.004, (T * 20) / 21, T * 0.998]
    expect(oddTrials(periods)).toEqual([2])
    expect(oddTrials([T, T * 1.01, T * 0.99])).toEqual([])
    // Two trials have no median to trust.
    expect(oddTrials([T, T * 1.2])).toEqual([])
  })
})
