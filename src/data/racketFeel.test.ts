import { describe, expect, it } from 'vitest'
import { compute } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from '../domain/types'
import { STOCK_RACKETS } from './rackets'
import { goalAdvice } from '../domain/goals'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { feelOffset, racketFeel, reviewOf } from './racketFeel'

const find = (model: string, year?: number) => STOCK_RACKETS.find((r) => r.model === model && (year === undefined || r.year === year))!
const stock = (model: string, year?: number) => {
  const r = find(model, year)
  const { result } = compute({ spec: r, baseMode: 'reference', measured: {}, accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false }, masses: DEFAULT_ACCESSORY_MASSES, leadG: emptyLead() })
  return racketFeel(r, result)
}

describe('feel from the playtests', () => {
  it('every stock frame has a review, its own or its family’s', () => {
    const missing = STOCK_RACKETS.filter((r) => !reviewOf(r)).map((r) => r.id)
    expect(missing).toEqual([])
    expect(STOCK_RACKETS.filter((r) => reviewOf(r)?.own).length).toBeGreaterThan(115)
  })

  it('spin lines spin: Pure Aero, Extreme, VCORE, SX', () => {
    expect(stock('Pure Aero', 2026).spin).toBeGreaterThan(85)
    expect(stock('Extreme MP', 2026).spin).toBeGreaterThan(62)
    expect(stock('Extreme Pro', 2024).spin).toBeGreaterThan(70)
    expect(stock('SX 300', 2022).spin).toBeGreaterThan(75)
    // The VCORE 98 is a spin frame, not a control one.
    const v = stock('VCORE 98 (305g)', 2026)
    expect(v.spin).toBeGreaterThan(70)
    expect(v.control).toBeLessThan(40)
  })

  it('control frames control; power frames power', () => {
    for (const [m, y] of [['Prestige Pro', 2023], ['Gravity Pro', 2025], ['Blade 98 18x20 v9', 2024], ['Percept 97D', 2023]] as const) expect(stock(m, y).control, m).toBeGreaterThan(75)
    expect(stock('Pure Drive', 2025).power).toBeGreaterThan(85)
    expect(stock('Blade 98 18x20 v9', 2024).spin).toBeLessThan(stock('Blade 98 16x19 v9', 2024).spin)
  })

  it('lead still moves it from there', () => {
    const r = find('Extreme MP', 2026)
    const base = { spec: r, baseMode: 'reference' as const, measured: {}, accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false }, masses: DEFAULT_ACCESSORY_MASSES }
    const a = racketFeel(r, compute({ ...base, leadG: emptyLead() }).result)
    const b = racketFeel(r, compute({ ...base, leadG: { ...emptyLead(), tip: 8 } }).result)
    expect(b.power).toBeGreaterThan(a.power)
    expect(b.manoeuvrability).toBeLessThan(a.manoeuvrability)
  })

  it('the goals read the same numbers as the feel, with lead or without', () => {
    const r = find('Pure Aero 98', 2026)
    const base = { spec: r, baseMode: 'reference' as const, measured: {}, accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false }, masses: DEFAULT_ACCESSORY_MASSES, strings: DEFAULT_STRINGBED }
    for (const leadG of [emptyLead(), { ...emptyLead(), tip: 2, threeNine: 4, handle: 3 }]) {
      const f = racketFeel(r, compute({ ...base, leadG }).result)
      for (const a of goalAdvice({ ...base, leadG, feelOffset: feelOffset(r) }, ['spin', 'power', 'control', 'stability', 'manoeuvrability'])) expect(Math.round(a.now), a.goal).toBe(f[a.goal as keyof typeof f])
    }
  })
})
