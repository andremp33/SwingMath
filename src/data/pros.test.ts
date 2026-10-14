import { describe, expect, it } from 'vitest'
import { PRO_TARGETS, withStrings } from './pros'
import { STOCK_RACKETS } from './rackets'

describe('pro targets', () => {
  it('every target has its source, link, date and kind of evidence', () => {
    for (const p of PRO_TARGETS) {
      expect(p.source.length, p.id).toBeGreaterThan(3)
      expect(p.url, p.id).toMatch(/^https:\/\/[\w.-]+\.\w+\//)
      expect(p.date, p.id).toMatch(/^(19|20)\d\d-(0[1-9]|1[0-2])$/)
      expect(p.date <= new Date().toISOString().slice(0, 7), p.id).toBe(true)
      expect(['measured', 'reported'], p.id).toContain(p.evidence)
      expect(['ATP', 'WTA'], p.id).toContain(p.tour)
    }
  })

  it('ids are unique', () => {
    expect(new Set(PRO_TARGETS.map((p) => p.id)).size).toBe(PRO_TARGETS.length)
  })

  it('the numbers are in plausible ranges for a tour racket', () => {
    for (const p of PRO_TARGETS) {
      const lo = p.strung ? 300 : 280
      expect(p.weightG >= lo && p.weightG <= 400, `${p.id} weight ${p.weightG}`).toBe(true)
      expect(p.balanceCm >= 30 && p.balanceCm <= 35, `${p.id} balance ${p.balanceCm}`).toBe(true)
      expect(p.swingweight >= (p.strung ? 300 : 270) && p.swingweight <= 390, `${p.id} SW ${p.swingweight}`).toBe(true)
      expect(p.headSizeSqIn >= 85 && p.headSizeSqIn <= 110, p.id).toBe(true)
      expect(p.lengthCm >= 68 && p.lengthCm <= 70, p.id).toBe(true)
    }
  })

  it('the stock racket to start from is in the library', () => {
    const linked = PRO_TARGETS.filter((p) => p.baseRacketId)
    expect(linked.length).toBeGreaterThan(0)
    for (const p of linked) expect(STOCK_RACKETS.some((r) => r.id === p.baseRacketId), `${p.id} → ${p.baseRacketId}`).toBe(true)
  })

  it('removing the strings and putting them back lands where it started', () => {
    for (const p of PRO_TARGETS) {
      const there = withStrings(p, p, p.strung, !p.strung)
      const back = withStrings(p, there, !p.strung, p.strung)
      expect(back.weightG).toBeCloseTo(p.weightG, 6)
      expect(back.balanceCm).toBeCloseTo(p.balanceCm, 6)
      expect(back.swingweight).toBeCloseTo(p.swingweight, 6)
    }
  })

  it('strings add their mass towards the head', () => {
    const nadal = PRO_TARGETS.find((p) => p.id === 'nadal')!
    const bare = withStrings(nadal, nadal, true, false)
    expect(nadal.weightG - bare.weightG).toBe(17)
    expect(bare.balanceCm).toBeLessThan(nadal.balanceCm)
    expect(nadal.swingweight - bare.swingweight).toBeGreaterThan(20)
  })

  it('same state: unchanged', () => {
    const p = PRO_TARGETS[0]
    expect(withStrings(p, p, true, true)).toBe(p)
  })
})
