import { describe, expect, it } from 'vitest'
import { compute } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from '../domain/types'
import { predictStrung, ROWS, STOCK_RACKETS } from './rackets'

const strungOnly = { strings: true, leatherGrip: false, overgrip: false, dampener: false }

describe('stock library', () => {
  it('has a unique id and a source link for every frame', () => {
    expect(new Set(STOCK_RACKETS.map((r) => r.id)).size).toBe(STOCK_RACKETS.length)
    for (const r of STOCK_RACKETS) expect(r.source).toMatch(/^https:\/\/www\.(tenniswarehouse-europe\.com\/.+descpage.+-EN|tennis-warehouse\.com\/learning_center\/racquet_reviews\/\w+review)\.html$/)
  })

  it('with strings on, gives back the strung numbers the source measured', () => {
    for (const r of STOCK_RACKETS) {
      const { result } = compute({ spec: r, baseMode: 'reference', measured: {}, accessories: strungOnly, leadG: emptyLead(), masses: DEFAULT_ACCESSORY_MASSES })
      expect(Math.abs(result.weightG - r.strung!.weightG), r.id).toBeLessThan(0.11)
      expect(Math.abs(result.balanceCm - r.strung!.balanceCm), r.id).toBeLessThan(0.011)
      expect(Math.abs(result.swingweight - r.strung!.swingweight), r.id).toBeLessThan(0.11)
    }
  })

  it('derived unstrung values are plausible', () => {
    for (const r of STOCK_RACKETS) {
      expect(r.weightG).toBeGreaterThan(270)
      expect(r.weightG).toBeLessThan(330)
      expect(r.swingweight).toBeGreaterThan(270)
      expect(r.swingweight).toBeLessThan(310)
    }
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
