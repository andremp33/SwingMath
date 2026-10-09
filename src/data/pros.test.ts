import { describe, expect, it } from 'vitest'
import { PRO_TARGETS, withStrings } from './pros'

describe('pro targets', () => {
  it('every target names a source with a link', () => {
    for (const p of PRO_TARGETS) {
      expect(p.source.length).toBeGreaterThan(3)
      expect(p.url).toMatch(/^https:\/\//)
    }
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
