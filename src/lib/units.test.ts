import { describe, expect, it } from 'vitest'
import { unitsOf } from './units'

describe('units', () => {
  const imp = unitsOf('imperial', 'en')
  const met = unitsOf('metric', 'pt')

  it('shows a racket in ounces and inches, as US shops print it', () => {
    expect(imp.weight(320)).toBe('11.3')
    expect(imp.balance(32.5)).toBe('12.80')
    expect(imp.weightUnit).toBe('oz')
    expect(imp.balanceUnit).toBe('in')
  })

  it('keeps grams and millimetres in metric', () => {
    expect(met.weight(320.4)).toBe('320')
    expect(met.balance(32.46)).toBe('325')
  })

  it('a field in ounces or inches stores grams and millimetres back', () => {
    expect(imp.fromWeight(imp.toWeight(318))).toBeCloseTo(318, 9)
    expect(imp.fromBalanceMm(12.8)).toBeCloseTo(325.12, 9)
    expect(met.fromWeight(318)).toBe(318)
  })

  it('differences in hundredths of an ounce or inch', () => {
    expect(imp.weightDelta(5)).toBe('+0.18')
    expect(imp.balanceDelta(-0.3)).toBe('−0.12')
  })
})
