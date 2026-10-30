import { describe, expect, it } from 'vitest'
import { feel } from './feel'
import { compute } from './physics'
import type { Stringbed } from './strings'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from './types'

const frame = { lengthCm: 68.58, headSizeSqIn: 98, weightG: 305, balanceCm: 32, swingweight: 294, ra: 62 }
const specs = compute({
  spec: frame,
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false },
  masses: DEFAULT_ACCESSORY_MASSES,
  leadG: emptyLead(),
}).result
const poly = (kg: number): Stringbed => ({ mains: { material: 'poly', tensionKg: kg } })
const at = (pattern: string, bed = poly(23)) => feel(specs, { ...frame, pattern }, bed)

describe('feel and the stringbed', () => {
  it('a dense pattern (18x20) controls more, spins and powers less than 16x19', () => {
    const open = at('16x19')
    const dense = at('18x20')
    expect(dense.control).toBeGreaterThan(open.control)
    expect(dense.spin).toBeLessThan(open.spin)
    expect(dense.power).toBeLessThan(open.power)
    // Mass properties do not change with the pattern.
    expect(dense.stability).toBe(open.stability)
    expect(dense.manoeuvrability).toBe(open.manoeuvrability)
    expect(dense.plow).toBe(open.plow)
  })

  it('more open still: 16x18 and 16x15 spin more', () => {
    expect(at('16x18').spin).toBeGreaterThan(at('16x19').spin)
    expect(at('16x15').spin).toBeGreaterThan(at('16x18').spin)
  })

  it('the pattern moves spin about twice as much as poly over a synthetic does', () => {
    const pattern = at('16x15').spin - at('16x19').spin
    const material = at('16x19').spin - at('16x19', { mains: { material: 'synthetic', tensionKg: 23 } }).spin
    expect(material).toBeGreaterThan(0)
    expect(pattern / material).toBeGreaterThan(1.4)
    expect(pattern / material).toBeLessThan(3.5)
  })

  it('more tension: more control, less power', () => {
    expect(at('16x19', poly(26)).control).toBeGreaterThan(at('16x19', poly(20)).control)
    expect(at('16x19', poly(26)).power).toBeLessThan(at('16x19', poly(20)).power)
  })
})
