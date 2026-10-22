import { describe, expect, it } from 'vitest'
import { goalAdvice, swingweightForLevel, type GoalInput } from './goals'
import { DEFAULT_ACCESSORY_MASSES, emptyLead } from './types'

const input: GoalInput = {
  spec: { lengthCm: 68.58, headSizeSqIn: 98, weightG: 305, balanceCm: 32, swingweight: 294, ra: 62, pattern: '16x19' },
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false },
  masses: DEFAULT_ACCESSORY_MASSES,
  leadG: emptyLead(),
  strings: { mains: { material: 'poly', tensionKg: 23 } },
}
const best = (goal: Parameters<typeof goalAdvice>[1][number]) => goalAdvice(input, [goal])[0].best

describe('goal advice', () => {
  it('power comes from lead at the tip', () => {
    expect(best('power')?.move).toEqual({ kind: 'lead', probe: 'tip', grams: 5 })
  })

  it('stability from lead at 3 and 9', () => {
    expect(best('stability')?.move).toEqual({ kind: 'lead', probe: 'threeNine', grams: 5 })
  })

  it('manoeuvrability and control from lead in the handle', () => {
    expect(best('manoeuvrability')?.move).toEqual({ kind: 'lead', probe: 'handle', grams: 5 })
    expect(best('control')?.move).toEqual({ kind: 'lead', probe: 'handle', grams: 5 })
  })

  it('spin and comfort from less tension', () => {
    expect(best('spin')?.move).toEqual({ kind: 'tension', kg: -2 })
    expect(best('comfort')?.move).toEqual({ kind: 'tension', kg: -2 })
  })

  it('names what each change costs', () => {
    // Lead at the tip makes the racket slower to swing.
    expect(best('power')?.cost?.goal).toBe('manoeuvrability')
  })

  it('one entry per goal, in the order asked, with where it is now', () => {
    const a = goalAdvice(input, ['spin', 'comfort'])
    expect(a.map((x) => x.goal)).toEqual(['spin', 'comfort'])
    for (const x of a) expect(x.now).toBeGreaterThan(5)
  })

  it('keeps the tension in a stringable range', () => {
    const loose = { ...input, strings: { mains: { material: 'poly' as const, tensionKg: 16 } } }
    expect(goalAdvice(loose, ['comfort'])[0].best?.move).not.toEqual({ kind: 'tension', kg: -2 })
  })
})

describe('swingweight for the level', () => {
  it('places a swingweight against the usual range', () => {
    expect(swingweightForLevel(300, 'beginner')).toBe('within')
    expect(swingweightForLevel(330, 'intermediate')).toBe('above')
    expect(swingweightForLevel(310, 'competition')).toBe('below')
  })
})
