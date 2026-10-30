import { describe, expect, it } from 'vitest'
import { estimateSwingweight } from '../domain/physics'
import { OFFICIAL } from './official'
import { RENAMED, ROWS, STOCK_RACKETS } from './rackets'

const MAKERS = /^https:\/\/(web\.archive\.org\/web\/\d{14}\/https:\/\/)?(www\.babolat\.com|www\.yonex\.com|www\.head\.com|([a-z]+\.)?wilson\.com|www\.wilson\.com|dunlopsports\.com|solincosports\.com|www\.volkltennis\.com)\//

describe('stock library', () => {
  it('has a unique id and the maker’s page for every frame', () => {
    expect(new Set(STOCK_RACKETS.map((r) => r.id)).size).toBe(STOCK_RACKETS.length)
    for (const r of STOCK_RACKETS) {
      expect(r.source, r.id).toMatch(MAKERS)
      expect(r.official?.href, r.id).toBe(r.source)
    }
  })

  it('weight and balance are the maker’s; swingweight too where it publishes one', () => {
    for (const r of STOCK_RACKETS) {
      const o = r.official!
      expect(r.weightG, r.id).toBe(o.weightG)
      expect(r.balanceCm * 10, r.id).toBeCloseTo(o.balanceMm!, 6)
      expect(r.specFrom, r.id).toEqual({ weight: 'official', balance: 'official', swingweight: o.swingweight === undefined ? 'estimated' : 'official' })
      if (o.swingweight !== undefined) expect(r.swingweight, r.id).toBe(o.swingweight)
      expect(r.ra, r.id).toBe(o.ra)
    }
    const aero = STOCK_RACKETS.find((r) => r.id === 'stock-babolat-pure-aero-98-2026')!
    expect(aero).toMatchObject({ weightG: 305, balanceCm: 31.5, swingweight: 295, ra: 71 })
    expect(aero.source).toMatch(/^https:\/\/web\.archive\.org\/web\/\d{14}\/https:\/\/www\.babolat\.com\//)
  })

  it('estimated swingweights are plausible for an unstrung frame', () => {
    for (const r of STOCK_RACKETS.filter((x) => x.specFrom?.swingweight === 'estimated')) {
      expect(r.swingweight, r.id).toBeGreaterThan(265)
      expect(r.swingweight, r.id).toBeLessThan(315)
    }
  })

  // The estimate against every frame whose maker publishes all three.
  it('the swingweight estimate gives Babolat’s published figures back within a few points', () => {
    const both = STOCK_RACKETS.filter((r) => r.official?.swingweight !== undefined)
    const err = both.map((r) => estimateSwingweight(r.weightG, r.balanceCm, r.lengthCm) - r.official!.swingweight!)
    const rms = Math.sqrt(err.reduce((a, e) => a + e * e, 0) / err.length)
    expect(both.length).toBeGreaterThan(20)
    expect(rms).toBeLessThan(6)
    expect(Math.abs(err.reduce((a, e) => a + e, 0) / err.length)).toBeLessThan(1.5)
  })

  it('old ids find their racket, or a sibling of the same model', () => {
    for (const [old, now] of Object.entries(RENAMED)) {
      expect(STOCK_RACKETS.some((r) => r.id === now), now).toBe(true)
      expect(STOCK_RACKETS.some((r) => r.id === old), old).toBe(false)
    }
  })

  it('every frame has its maker’s entry, and every entry a frame', () => {
    const keys = new Set(ROWS.map((r) => `${r.brand}|${r.model}|${r.year ?? ''}`))
    for (const k of keys) expect(OFFICIAL[k]?.balanceMm, k).toBeDefined()
    for (const k of Object.keys(OFFICIAL)) expect(keys.has(k), k).toBe(true)
  })
})
