import { describe, expect, it } from 'vitest'
import { distanceTo, leadStrips, nearestTarget, racketPreview, STRIP_G } from './preview'
import type { Base } from './physics'
import { emptyLead } from './types'

const base: Base = { lengthCm: 68.58, headSizeSqIn: 98, weightG: 318, balanceCm: 32.4, swingweight: 318 }

describe('paywall preview', () => {
  it('turns a plan into strips: whole strips, both sides of a split position', () => {
    expect(leadStrips(emptyLead())).toEqual([])
    const s = leadStrips({ ...emptyLead(), tip: 2, threeNine: 3, handle: 0.4 })
    // 2 at the tip, 1.5 a side at 3 and 9 (two strips each side), part of one in the handle.
    expect(s.filter((x) => x.position === 'tip')).toHaveLength(2)
    expect(s.filter((x) => x.position === 'threeNine')).toHaveLength(4)
    expect(s.filter((x) => x.position === 'threeNine' && x.side === 1)).toHaveLength(2)
    expect(s.filter((x) => x.position === 'handle')).toHaveLength(1)
    expect(s.map((x) => x.position)).toEqual(['tip', 'tip', 'threeNine', 'threeNine', 'threeNine', 'threeNine', 'handle'])
    // Exactly one strip's worth is one strip.
    expect(leadStrips({ ...emptyLead(), tip: STRIP_G })).toHaveLength(1)
  })

  it('the nearest pro is one lead can reach', () => {
    const me = { weightG: 318, balanceCm: 32.4, swingweight: 318 }
    const lighter = { id: 'lighter', specs: { weightG: 310, balanceCm: 32.4, swingweight: 315 } }
    const close = { id: 'close', specs: { weightG: 322, balanceCm: 32.6, swingweight: 325 } }
    const far = { id: 'far', specs: { weightG: 345, balanceCm: 32, swingweight: 345 } }
    expect(nearestTarget(me, [far, lighter, close])?.id).toBe('close')
    expect(distanceTo(me, lighter.specs)).toBeGreaterThan(distanceTo(me, far.specs))
    // When none can be reached, the least far.
    expect(nearestTarget(me, [lighter])?.id).toBe('lighter')
    expect(nearestTarget(me, [])).toBeUndefined()
  })

  it('previews the plan to the pro, swingweight going up; none when the racket is heavier', () => {
    const p = racketPreview(base, { weightG: 324, balanceCm: 32.8, swingweight: 330 })!
    expect(p.strips.length).toBeGreaterThan(0)
    expect(p.fromSw).toBe(318)
    expect(Math.abs(p.toSw - 330)).toBeLessThanOrEqual(2)
    expect(racketPreview(base, { weightG: 305, balanceCm: 32, swingweight: 300 })).toBeNull()
  })
})
