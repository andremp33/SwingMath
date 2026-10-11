import { describe, expect, it } from 'vitest'
import { compute } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from '../domain/types'
import { predictStrung, RENAMED, ROWS, STOCK_RACKETS } from './rackets'

const strungOnly = { strings: true, leatherGrip: false, overgrip: false, dampener: false }

describe('stock library', () => {
  it('has a unique id and a source link for every frame', () => {
    expect(new Set(STOCK_RACKETS.map((r) => r.id)).size).toBe(STOCK_RACKETS.length)
    for (const r of STOCK_RACKETS) expect(r.source).toMatch(/^https:\/\/www\.(tenniswarehouse-europe\.com\/.+descpage.+-EN|tennis-warehouse\.com\/learning_center\/racquet_reviews\/\w+review)\.html$/)
  })

  it('the measurement, with strings on, gives back the strung numbers the source measured', () => {
    for (const r of STOCK_RACKETS) {
      const spec = { ...r, ...r.measured! }
      const { result } = compute({ spec, baseMode: 'reference', measured: {}, accessories: strungOnly, leadG: emptyLead(), masses: DEFAULT_ACCESSORY_MASSES })
      expect(Math.abs(result.weightG - r.strung!.weightG), r.id).toBeLessThan(0.11)
      expect(Math.abs(result.balanceCm - r.strung!.balanceCm), r.id).toBeLessThan(0.011)
      expect(Math.abs(result.swingweight - r.strung!.swingweight), r.id).toBeLessThan(0.11)
    }
  })

  it('derived unstrung values are plausible', () => {
    for (const r of STOCK_RACKETS) {
      expect(r.weightG).toBeGreaterThan(270)
      expect(r.weightG).toBeLessThanOrEqual(330)
      expect(r.swingweight).toBeGreaterThan(270)
      // The Rafa Origin is built to Nadal's match specs: 371 strung.
      expect(r.swingweight).toBeLessThan(345)
    }
  })

  it('reference values come from the maker where its page gives them', () => {
    const o = STOCK_RACKETS.find((r) => r.id === 'stock-babolat-pure-aero-98-2026')!
    expect(o).toMatchObject({ weightG: 305, balanceCm: 31.5, swingweight: 295, specFrom: { weight: 'official', balance: 'official', swingweight: 'official' } })
    expect(o.official?.href).toMatch(/^https:\/\/web\.archive\.org\/web\/\d{14}\/https:\/\/www\.babolat\.com\//)
    const y = STOCK_RACKETS.find((r) => r.id === 'stock-yonex-ezone-98-2022')!
    expect(y.specFrom).toEqual({ weight: 'official', balance: 'official', swingweight: 'measured' })
  })

  it('old ids still find their racket', () => {
    for (const [old, now] of Object.entries(RENAMED)) {
      expect(STOCK_RACKETS.some((r) => r.id === now), now).toBe(true)
      expect(STOCK_RACKETS.some((r) => r.id === old), old).toBe(false)
    }
  })

  // An independent measurement against the maker's figures: printed for
  // replica/official-specs.md; most should sit inside the makers' tolerance.
  it('measurements mostly agree with the makers', () => {
    const both = STOCK_RACKETS.filter((r) => r.official)
    const off = both.filter((r) => !r.agrees).map((r) => ({
      id: r.id,
      dWeight: Math.round((r.measured!.weightG - r.official!.weightG) * 10) / 10,
      dBalanceMm: r.official!.balanceMm === undefined ? null : Math.round((r.measured!.balanceCm * 10 - r.official!.balanceMm) * 10) / 10,
      dSw: r.official!.swingweight === undefined ? null : Math.round((r.measured!.swingweight - r.official!.swingweight) * 10) / 10,
    }))
    console.log(JSON.stringify({ checked: both.length, outside: off.length, off }))
    expect(both.length).toBeGreaterThan(40)
    expect(off.length / both.length).toBeLessThan(0.25)
  })

  // The string model, checked against frames whose page lists the
  // manufacturer's unstrung nominal values next to the strung measurement.
  it('string model: strung balance predicted from nominal values lands within a few mm', () => {
    const rows = ROWS.filter((r) => r.nominal).map((r) => {
      const p = predictStrung(r)!
      return { model: `${r.brand} ${r.model} ${r.year ?? ''}`.trim(), dW: p.weightG - r.weight, dBmm: (p.balanceCm - r.balanceCm) * 10 }
    })
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const absB = rows.map((r) => Math.abs(r.dBmm))
    // Printed for replica/validation.md.
    console.log(JSON.stringify({ n: rows.length, meanAbsBalanceMm: mean(absB), maxAbsBalanceMm: Math.max(...absB), meanWeightG: mean(rows.map((r) => r.dW)), rows }))
    expect(rows.length).toBeGreaterThan(20)
    expect(mean(absB)).toBeLessThan(4)
  })
})
