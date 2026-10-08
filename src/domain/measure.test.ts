import { describe, expect, it } from 'vitest'
import { periodFromSwingweight, swingweightFromPeriod, swingweightUncertainty } from './measure'

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

  it('timing more swings shrinks the uncertainty', () => {
    const few = swingweightUncertainty(320, 1.32, 5)
    const many = swingweightUncertainty(320, 1.32, 30)
    expect(many).toBeLessThan(few)
    // 30 swings by hand: about ±3.4; averaging 3 trials brings it to about ±2.
    expect(many).toBeCloseTo(320 * 2 * ((0.15 * Math.SQRT2) / 30 / 1.32), 6)
    expect(swingweightUncertainty(320, 1.32, 30, 3)).toBeLessThan(2.1)
  })
})
