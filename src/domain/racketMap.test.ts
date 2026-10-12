import { describe, expect, it } from 'vitest'
import { STOCK_RACKETS } from '../data/rackets'
import { mapLayout, openness } from './racketMap'

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
    const show = (r: ReturnType<typeof find>) => ({ id: r.id, ...place(r) })
    const aero = show(find('Babolat', 'Pure Aero', 2026))
    const drive = show(find('Babolat', 'Pure Drive', 2025))
    const prestige = show(find('Head', 'Prestige MP', 2023))
    const ps97 = show(find('Wilson', 'Pro Staff 97 v14', 2023))
    console.log(JSON.stringify([aero, drive, prestige, ps97]))
    // Spin and power for the Aero; touch and control for the classics.
    expect(aero.y).toBeGreaterThan(0)
    expect(aero.x).toBeGreaterThan(0)
    expect(drive.x).toBeGreaterThan(0)
    expect(prestige.x).toBeLessThan(0)
    expect(prestige.y).toBeLessThan(0)
    expect(ps97.x).toBeLessThan(0)
    expect(aero.y).toBeGreaterThan(prestige.y)
  })
})
