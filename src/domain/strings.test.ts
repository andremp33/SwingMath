import { describe, expect, it } from 'vitest'
import { armComfort } from './comfort'
import { gripInches, gripMm, gripSize } from './grip'
import { compute } from './physics'
import { equivalentTension, parsePattern, stringbedIndex, stringFeel, stringLife, tensionRetained, type Stringbed } from './strings'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from './types'

const f100 = { headSizeSqIn: 100, pattern: '16x19' }
const syn = (kg: number): Stringbed => ({ mains: { material: 'synthetic', tensionKg: kg } })
const poly = (kg: number): Stringbed => ({ mains: { material: 'poly', tensionKg: kg } })

describe('stringbed', () => {
  it('reference is 100', () => {
    expect(stringbedIndex(f100, syn(23))).toBeCloseTo(100, 6)
  })

  it('reads patterns, with a fallback', () => {
    expect(parsePattern('18x20')).toEqual([18, 20])
    expect(parsePattern('16 × 19')).toEqual([16, 19])
    expect(parsePattern(undefined)).toEqual([16, 19])
  })

  it('is stiffer with more tension, a denser pattern, a smaller head and a stiffer string', () => {
    const base = stringbedIndex(f100, syn(23))
    expect(stringbedIndex(f100, syn(25))).toBeGreaterThan(base)
    expect(stringbedIndex({ headSizeSqIn: 100, pattern: '18x20' }, syn(23))).toBeGreaterThan(base)
    expect(stringbedIndex({ headSizeSqIn: 95, pattern: '16x19' }, syn(23))).toBeGreaterThan(base)
    expect(stringbedIndex(f100, poly(23))).toBeGreaterThan(base)
    expect(stringbedIndex(f100, { mains: { material: 'gut', tensionKg: 23 } })).toBeLessThan(base)
  })

  it('a denser pattern adds a few percent, not tens of percent', () => {
    const r = stringbedIndex({ headSizeSqIn: 98, pattern: '18x20' }, syn(23)) / stringbedIndex({ headSizeSqIn: 98, pattern: '16x19' }, syn(23))
    expect(r).toBeGreaterThan(1.04)
    expect(r).toBeLessThan(1.15)
  })

  it('equivalent tension: lower in a denser pattern, round trip lands back', () => {
    const from = { frame: { headSizeSqIn: 98, pattern: '16x19' }, bed: poly(24) }
    const to = { frame: { headSizeSqIn: 98, pattern: '18x20' }, bed: poly(24) }
    const eq = equivalentTension(from, to)
    expect(eq.mainsKg).toBeLessThan(24)
    expect(eq.mainsKg).toBeGreaterThan(20)
    const back = equivalentTension({ frame: to.frame, bed: poly(eq.mainsKg) }, { frame: from.frame, bed: poly(eq.mainsKg) })
    expect(Math.abs(back.mainsKg - 24)).toBeLessThanOrEqual(0.5)
  })

  it('equivalent tension keeps a hybrid’s split', () => {
    const bed: Stringbed = { mains: { material: 'poly', tensionKg: 24 }, crosses: { material: 'multi', tensionKg: 22 } }
    const eq = equivalentTension({ frame: f100, bed: poly(23) }, { frame: f100, bed })
    // Scaled in proportion, then rounded to half a kilo.
    expect(Math.abs(eq.mainsKg - eq.crossesKg - 2)).toBeLessThanOrEqual(0.5)
  })
})

describe('string life', () => {
  it('poly loses more tension than gut, and keeps losing with play', () => {
    expect(tensionRetained('poly', 10, 14)).toBeLessThan(tensionRetained('gut', 10, 14))
    expect(tensionRetained('poly', 20, 14)).toBeLessThan(tensionRetained('poly', 5, 14))
    expect(tensionRetained('poly', 0, 0)).toBeCloseTo(1, 6)
  })

  it('used goes from 0 to 1 with play, or with time on the racket', () => {
    expect(stringLife(poly(23), 0, 0).used).toBe(0)
    expect(stringLife(poly(23), 18, 7).used).toBeCloseTo(1, 6)
    const old = stringLife(poly(23), 2, 56)
    expect(old.used).toBeCloseTo(1, 6)
    expect(old.limit).toBe('time')
  })

  it('the player’s own life in hours wins', () => {
    expect(stringLife(poly(23), 12, 3, 24).used).toBeCloseTo(0.5, 6)
  })

  it('a hybrid lives as long as its weakest string', () => {
    const hybrid: Stringbed = { mains: { material: 'gut', tensionKg: 24 }, crosses: { material: 'poly', tensionKg: 23 } }
    expect(stringLife(hybrid, 18, 1).used).toBeCloseTo(1, 6)
  })
})

describe('string feel', () => {
  it('lower tension: more power and comfort, less control', () => {
    const lo = stringFeel(f100, poly(20))
    const hi = stringFeel(f100, poly(27))
    expect(lo.power).toBeGreaterThan(hi.power)
    expect(lo.comfort).toBeGreaterThan(hi.comfort)
    expect(lo.control).toBeLessThan(hi.control)
  })

  it('poly in an open pattern spins more than multi in a dense one', () => {
    const open = stringFeel({ headSizeSqIn: 100, pattern: '16x18' }, poly(23))
    const dense = stringFeel({ headSizeSqIn: 98, pattern: '18x20' }, { mains: { material: 'multi', tensionKg: 23 } })
    expect(open.spin).toBeGreaterThan(dense.spin)
  })
})

describe('arm comfort', () => {
  const specsOf = (weightG: number, balanceCm: number) =>
    compute({
      spec: { lengthCm: 68.58, headSizeSqIn: 100, weightG, balanceCm, swingweight: 290 },
      baseMode: 'reference',
      measured: {},
      accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
      leadG: emptyLead(),
      masses: DEFAULT_ACCESSORY_MASSES,
    }).result

  it('a soft, heavy, head-light frame with multi beats a stiff light one with poly', () => {
    const kind = armComfort(specsOf(320, 31.5), { ...f100, ra: 60 }, { mains: { material: 'multi', tensionKg: 22 } })
    const harsh = armComfort(specsOf(285, 34.5), { ...f100, ra: 72 }, poly(26))
    expect(kind.score).toBeGreaterThan(harsh.score + 30)
    expect(kind.score).toBeLessThanOrEqual(95)
    expect(harsh.score).toBeGreaterThanOrEqual(5)
  })

  it('lists the factor costing the most points first', () => {
    const c = armComfort(specsOf(320, 31.5), { ...f100, ra: 72 }, { mains: { material: 'gut', tensionKg: 22 } })
    expect(c.factors[0].key).toBe('ra')
  })
})

describe('grip size', () => {
  it('an overgrip is half a size, a sleeve a full size', () => {
    expect(gripSize(2, 1, 0)).toBe(2.5)
    expect(gripSize(2, 0, 1)).toBe(3)
    expect(gripInches(2)).toBe('4 1/4"')
    expect(gripInches(2.5)).toBe('4 5/16"')
    expect(gripInches(0)).toBe('4"')
    expect(gripMm(3)).toBe(111)
  })

  it('sleeves and overgrips add mass at the handle', () => {
    const base = {
      spec: { lengthCm: 68.58, headSizeSqIn: 100, weightG: 300, balanceCm: 33, swingweight: 290 },
      baseMode: 'reference' as const,
      measured: {},
      accessories: { strings: false, leatherGrip: false, overgrip: false, dampener: false },
      leadG: emptyLead(),
      masses: DEFAULT_ACCESSORY_MASSES,
    }
    const plain = compute(base).result
    const built = compute({ ...base, grip: { base: 2, extraOvergrips: 1, sleeves: 1 } }).result
    expect(built.weightG - plain.weightG).toBeCloseTo(DEFAULT_ACCESSORY_MASSES.overgrip + DEFAULT_ACCESSORY_MASSES.sleeve, 6)
    expect(built.balanceCm).toBeLessThan(plain.balanceCm)
  })
})
