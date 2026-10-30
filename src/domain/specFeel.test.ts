import { describe, expect, it } from 'vitest'
import { compute } from './physics'
import { LEAN_POINTS, PRIOR_PLAYERS, specFeel, startingFeel, type StartFrame } from './specFeel'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from './types'

const frame = { lengthCm: 68.58, headSizeSqIn: 100, pattern: '16x19', ra: 69 } satisfies StartFrame
const stock = compute({
  spec: { ...frame, weightG: 300, balanceCm: 32, swingweight: 290 },
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false },
  masses: DEFAULT_ACCESSORY_MASSES,
  leadG: emptyLead(),
}).result

describe('feel from the specs', () => {
  it('the line adds its lean, and only to what it leans to', () => {
    const plain = specFeel(stock, frame)
    const spin = specFeel(stock, { ...frame, leans: ['spin'] })
    expect(spin.spin - plain.spin).toBeCloseTo(LEAN_POINTS, 6)
    expect(spin.power).toBe(plain.power)
    expect(spin.control).toBe(plain.control)
  })

  it('a stiffer, more open frame: more power and spin, less touch', () => {
    const soft = specFeel(stock, { ...frame, ra: 60, pattern: '18x20' })
    const stiff = specFeel(stock, { ...frame, ra: 72, pattern: '16x19' })
    expect(stiff.power).toBeGreaterThan(soft.power)
    expect(stiff.spin).toBeGreaterThan(soft.spin)
    expect(stiff.touch).toBeLessThan(soft.touch)
  })
})

describe('players’ ratings on top of the specs', () => {
  const ratings = { power: 80, control: 30, spin: 70 }

  it('n = 0, or none, gives exactly the specs’ estimate', () => {
    const prior = specFeel(stock, frame)
    expect(startingFeel(stock, frame)).toEqual(prior)
    expect(startingFeel(stock, frame, { n: 0, ...ratings })).toEqual(prior)
  })

  it('as many players as the prior is worth: halfway', () => {
    const prior = specFeel(stock, frame)
    const half = startingFeel(stock, frame, { n: PRIOR_PLAYERS, ...ratings })
    expect(half.power).toBeCloseTo((prior.power + ratings.power) / 2, 6)
    expect(half.control).toBeCloseTo((prior.control + ratings.control) / 2, 6)
    expect(half.touch).toBe(prior.touch)
  })

  it('many players take over', () => {
    const many = startingFeel(stock, frame, { n: 10_000, ...ratings })
    expect(many.spin).toBeCloseTo(ratings.spin, 0)
  })
})
