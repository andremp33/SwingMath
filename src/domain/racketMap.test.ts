import { describe, expect, it } from 'vitest'
import { STOCK_RACKETS } from '../data/rackets'
import { mapLayout } from './racketMap'
import { openness } from './strings'

const find = (brand: string, model: string, year?: number) => STOCK_RACKETS.find((r) => r.brand === brand && r.model === model && (year === undefined || r.year === year))!

describe('racket map', () => {
  const place = mapLayout(STOCK_RACKETS)

  it('open patterns are more open', () => {
    expect(openness(100, '16x19')).toBeGreaterThan(openness(98, '18x20'))
  })

  it('every frame lands inside the circle', () => {
    for (const r of STOCK_RACKETS) {
      const p = place(r)
      expect(Math.hypot(p.x, p.y), r.id).toBeLessThanOrEqual(0.951)
    }
  })

  it('known frames land where players expect', () => {
    const at = (brand: string, model: string, year: number) => place(find(brand, model, year))
    // Spin and power: Pure Aero, Extreme, Blackout. Touch and control: Prestige, Gravity, Percept.
    for (const [b, m, y] of [['Babolat', 'Pure Aero', 2026], ['Head', 'Extreme Pro', 2024], ['Solinco', 'Blackout 300', 2022]] as const) {
      expect(at(b, m, y).x, m).toBeGreaterThan(0)
      expect(at(b, m, y).y, m).toBeGreaterThan(0)
    }
    for (const [b, m, y] of [['Head', 'Prestige Pro', 2023], ['Head', 'Gravity Pro', 2025], ['Yonex', 'Percept 97D', 2023]] as const) {
      expect(at(b, m, y).x, m).toBeLessThan(0)
      expect(at(b, m, y).y, m).toBeLessThan(0)
    }
    expect(at('Babolat', 'Pure Drive', 2025).x).toBeGreaterThan(0.5)
  })
})
