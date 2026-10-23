import { useMemo } from 'react'
import { useStore, type UnitSystem } from '../data/store'
import { fmtNum, fmtSigned } from './format'

export const G_PER_OZ = 28.349523125
export const MM_PER_IN = 25.4

/**
 * A racket's weight and balance as the player reads them: grams and
 * millimetres, or ounces (to a tenth) and inches (to a hundredth), as US
 * shops print them. Lead stays in grams everywhere: tape is sold, weighed
 * and cut that way. Values in and out of the app's model stay metric.
 */
export function unitsOf(system: UnitSystem, lang: string) {
  const imperial = system === 'imperial'
  const oz = (g: number) => g / G_PER_OZ
  const inch = (mm: number) => mm / MM_PER_IN
  return {
    imperial,
    weightUnit: imperial ? 'oz' : 'g',
    balanceUnit: imperial ? 'in' : 'mm',
    lengthUnit: imperial ? 'in' : 'cm',
    /** "320" or "11.3", without the unit. */
    weight: (g: number | undefined) => (g === undefined ? '' : imperial ? fmtNum(oz(g), 1, lang) : fmtNum(g, 0, lang)),
    /** Balance from cm: "324" (mm) or "12.76" (in). */
    balance: (cm: number | undefined) => (cm === undefined ? '' : imperial ? fmtNum(inch(cm * 10), 2, lang) : fmtNum(cm * 10, 0, lang)),
    /** A length from cm (sweet spot, frame): "54.9" (cm) or "21.6" (in). */
    length: (cm: number | undefined) => (cm === undefined ? '' : imperial ? fmtNum(inch(cm * 10), 1, lang) : fmtNum(cm, 1, lang)),
    /** A difference: to hundredths of an ounce or inch, or `digits` of a gram or mm. */
    weightDelta: (g: number, digits = 1) => (imperial ? fmtSigned(oz(g), 2, lang) : fmtSigned(g, digits, lang)),
    balanceDelta: (cm: number, digits = 1) => (imperial ? fmtSigned(inch(cm * 10), 2, lang) : fmtSigned(cm * 10, digits, lang)),
    /** For a field: the stored grams or mm shown in the player's unit, and back. */
    toWeight: (g: number) => (imperial ? oz(g) : g),
    fromWeight: (v: number) => (imperial ? v * G_PER_OZ : v),
    toBalanceMm: (mm: number) => (imperial ? inch(mm) : mm),
    fromBalanceMm: (v: number) => (imperial ? v * MM_PER_IN : v),
  }
}

export type Units = ReturnType<typeof unitsOf>

export function useUnits(): Units {
  const system = useStore((s) => s.units)
  const lang = useStore((s) => s.lang)
  return useMemo(() => unitsOf(system, lang), [system, lang])
}
