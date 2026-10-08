import { describe, expect, it } from 'vitest'
import { matchRackets, scoreErrors, solveTarget } from './match'
import { applyMasses, geometry, leadElements, type Base } from './physics'
import { emptyLead, POSITIONS } from './types'

const base: Base = {
  lengthCm: 68.58,
  headSizeSqIn: 98,
  weightG: 305,
  balanceCm: 31.5,
  swingweight: 285,
  twistweight: 13.2,
}

function specsWith(b: Base, lead: Partial<Record<(typeof POSITIONS)[number], number>>) {
  const g = geometry(b.lengthCm, b.headSizeSqIn)
  return applyMasses(b, leadElements(g, { ...emptyLead(), ...lead }))
}

describe('solveTarget (hit a target)', () => {
  it('recovers a target made from a known lead plan', () => {
    const t = specsWith(base, { tip: 3, threeNine: 4, handle: 5 })
    const r = solveTarget(base, {
      weightG: t.weightG,
      balanceCm: t.balanceCm,
      swingweight: t.swingweight,
      twistweight: t.twistweight,
    })
    expect(r.matchPct).toBeGreaterThanOrEqual(97)
    expect(Math.abs(r.errors.weightG!)).toBeLessThanOrEqual(1)
    expect(Math.abs(r.errors.swingweight!)).toBeLessThanOrEqual(1)
    expect(Math.abs(r.errors.balanceCm!)).toBeLessThanOrEqual(0.1)
    for (const p of POSITIONS) expect(r.lead[p]).toBeGreaterThanOrEqual(0)
  })

  it('uses steps of 0.5 g', () => {
    const r = solveTarget(base, { weightG: 315, swingweight: 300 })
    for (const p of POSITIONS) expect((r.lead[p] * 2) % 1).toBe(0)
  })

  it('returns zero lead when the target is the frame itself', () => {
    const r = solveTarget(base, { weightG: 305, balanceCm: 31.5, swingweight: 285 })
    expect(r.totalG).toBe(0)
    expect(r.matchPct).toBe(100)
  })

  it('flags targets lighter than the frame as unreachable', () => {
    const r = solveTarget(base, { weightG: 290, swingweight: 280 })
    expect(r.unreachable).toContain('weightG')
    expect(r.unreachable).toContain('swingweight')
    expect(r.totalG).toBe(0)
  })

  it('respects allowed positions', () => {
    const r = solveTarget(base, { weightG: 312, swingweight: 300 }, { allowed: ['tip', 'handle'] })
    expect(r.lead.threeNine).toBe(0)
    expect(r.lead.tenTwo).toBe(0)
    expect(r.lead.throat).toBe(0)
  })

  it('scores 100 for no error and drops with error', () => {
    expect(scoreErrors({ weightG: 0, swingweight: 0 })).toBe(100)
    expect(scoreErrors({ weightG: 5 })).toBe(50)
    expect(scoreErrors({ weightG: 50 })).toBe(0)
  })
})

describe('matchRackets', () => {
  it('brings two slightly different frames to one target', () => {
    const b2: Base = { ...base, weightG: 302, balanceCm: 31.8, swingweight: 288, twistweight: 13.0 }
    const r = matchRackets([base, b2])
    expect(r.plans).toHaveLength(2)
    expect(r.matchPct).toBeGreaterThan(90)
    for (const plan of r.plans) for (const p of POSITIONS) expect(plan.lead[p]).toBeGreaterThanOrEqual(0)
    // After the plan, the two frames end up close to each other.
    const [a, c] = r.plans.map((p) => p.result)
    expect(Math.abs(a.weightG - c.weightG)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.swingweight - c.swingweight)).toBeLessThanOrEqual(2)
  })
})
