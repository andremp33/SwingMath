import { describe, expect, it } from 'vitest'
import { diagnose, FREE_PLANS, freePlansLeft, matchPlanKey, planAccess, targetPlanKey, withPlan } from './freePlans'
import { solveTarget } from './match'
import type { Base } from './physics'

describe('free plans', () => {
  it('a plan is its start and its target’s source; racquets to match in any order', () => {
    expect(targetPlanKey('owned:a', 'pro:sinner')).toBe(targetPlanKey('owned:a', 'pro:sinner'))
    expect(targetPlanKey('owned:a', 'pro:sinner')).not.toBe(targetPlanKey('owned:a', 'pro:nadal'))
    expect(targetPlanKey('owned:a', 'typed')).not.toBe(targetPlanKey('setup:b', 'typed'))
    expect(matchPlanKey(['b', 'a', 'c'])).toBe(matchPlanKey(['c', 'b', 'a']))
  })

  it('three new plans are free; the same plan again never counts', () => {
    let plans: string[] = []
    for (const k of ['p1', 'p2', 'p3']) {
      const a = planAccess(plans, k, false)
      expect(a).toEqual({ full: true, spends: true })
      plans = withPlan(plans, k)
    }
    expect(freePlansLeft(plans)).toBe(0)
    // The same plan again: whole, and free.
    expect(planAccess(plans, 'p2', false)).toEqual({ full: true, spends: false })
    expect(withPlan(plans, 'p2')).toBe(plans)
    // A fourth new plan: only the diagnosis.
    expect(planAccess(plans, 'p4', false)).toEqual({ full: false, spends: false })
    expect(plans).toHaveLength(FREE_PLANS)
  })

  it('Pro sees every plan whole and spends nothing', () => {
    expect(planAccess(['a', 'b', 'c'], 'd', true)).toEqual({ full: true, spends: false })
  })

  it('the diagnosis: what is missing, whether it is reachable, and where the plan lands', () => {
    const base: Base = { lengthCm: 68.58, headSizeSqIn: 100, weightG: 300, balanceCm: 32, swingweight: 290 }
    const target = { weightG: 310, swingweight: 310 }
    const res = solveTarget(base, target)
    const d = diagnose(base, target, res)
    expect(d.missing).toEqual({ weightG: 10, swingweight: 20 })
    expect(d.reachable).toBe(true)
    expect(d.final.weightG).toBeCloseTo(310, 0)
    // Lighter than the frame: lead only adds.
    const light = diagnose(base, { weightG: 290 }, solveTarget(base, { weightG: 290 }))
    expect(light.missing.weightG).toBe(-10)
    expect(light.reachable).toBe(false)
  })
})
