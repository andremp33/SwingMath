import { describe, expect, it } from 'vitest'
import { compute } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from '../domain/types'
import { STOCK_RACKETS } from './rackets'
import { goalAdvice } from '../domain/goals'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { feelOffset, feelTarget, racketFeel } from './racketFeel'

const find = (model: string, year?: number) => STOCK_RACKETS.find((r) => r.model === model && (year === undefined || r.year === year))!
const stock = (model: string, year?: number) => {
  const r = find(model, year)
  const { result } = compute({ spec: r, baseMode: 'reference', measured: {}, accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false }, masses: DEFAULT_ACCESSORY_MASSES, leadG: emptyLead() })
  return racketFeel(r, result)
}

describe('feel from the specs and the line', () => {
  it('every stock frame has a start; the player’s own have none', () => {
    expect(STOCK_RACKETS.filter((r) => !feelTarget(r)).map((r) => r.id)).toEqual([])
    expect(feelTarget({ ...find('Pure Drive', 2025), isStock: false })).toBeUndefined()
  })

  // Golden: frames players know, in the order everyone agrees on.
  it('power: Pure Drive over Pure Strike, Ultra over Clash, Pure Drive over Blade', () => {
    expect(stock('Pure Drive', 2025).power).toBeGreaterThan(stock('Pure Strike 98 18x20', 2024).power)
    expect(stock('Ultra 100 v5', 2025).power).toBeGreaterThan(stock('Clash 100 v3', 2025).power)
    expect(stock('Pure Drive', 2025).power).toBeGreaterThan(stock('Blade 98 16x19 v10', 2026).power)
  })

  it('spin: Pure Aero over Blade, Extreme over Prestige, VCORE over Percept, 16x19 over 18x20', () => {
    expect(stock('Pure Aero', 2026).spin).toBeGreaterThan(stock('Blade 98 16x19 v10', 2026).spin)
    expect(stock('Extreme MP', 2026).spin).toBeGreaterThan(stock('Prestige MP', 2023).spin)
    expect(stock('VCORE 98 (305g)', 2026).spin).toBeGreaterThan(stock('Percept 97', 2023).spin)
    expect(stock('Blade 98 18x20 v9', 2024).spin).toBeLessThan(stock('Blade 98 16x19 v9', 2024).spin)
  })

  it('control: Prestige, Gravity Pro and Pure Strike over Pure Drive and Pure Aero', () => {
    for (const [m, y] of [['Prestige Pro', 2023], ['Gravity Pro', 2025], ['Pure Strike 98 18x20', 2024], ['Percept 97D', 2023]] as const) {
      expect(stock(m, y).control, m).toBeGreaterThan(stock('Pure Drive', 2025).control + 10)
      expect(stock(m, y).control, m).toBeGreaterThan(stock('Pure Aero', 2026).control + 10)
    }
  })

  it('a spin frame spins more than it controls; a control frame the other way round', () => {
    const aero = stock('Pure Aero', 2026)
    expect(aero.spin).toBeGreaterThan(aero.control)
    const prestige = stock('Prestige Pro', 2023)
    expect(prestige.control).toBeGreaterThan(prestige.spin)
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
