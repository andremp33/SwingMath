import { SW_AXIS_CM } from './physics'

const G = 9.80665

/**
 * Swingweight from a pendulum test at home: hang the racket on a thin rod
 * through (or under) the handle at `pivotCm` from the butt, let it swing a
 * little, and time full swings. For a physical pendulum
 *   I_pivot = m · g · d · T² / (4π²),  d = distance pivot → balance point.
 * The result is moved to the standard 10 cm axis with the parallel-axis rule.
 */
export function swingweightFromPeriod(weightG: number, balanceCm: number, periodS: number, pivotCm = SW_AXIS_CM): number {
  const m = weightG / 1000
  const d = (balanceCm - pivotCm) / 100 // m
  const iPivot = (m * G * d * periodS ** 2) / (4 * Math.PI ** 2) // kg·m²
  const iCm = iPivot - m * d * d
  const d10 = (balanceCm - SW_AXIS_CM) / 100
  return (iCm + m * d10 * d10) * 1e4 // kg·cm²
}

/** The period a racket with these specs would show (used for tests and hints). */
export function periodFromSwingweight(weightG: number, balanceCm: number, swingweight: number, pivotCm = SW_AXIS_CM): number {
  const m = weightG / 1000
  const d10 = (balanceCm - SW_AXIS_CM) / 100
  const d = (balanceCm - pivotCm) / 100
  const iCm = swingweight / 1e4 - m * d10 * d10
  const iPivot = iCm + m * d * d
  return 2 * Math.PI * Math.sqrt(iPivot / (m * G * d))
}

/**
 * How far off the swingweight can be from timing by hand: reaction time on
 * start and stop (about 0.15 s each) spread over N swings. SW grows with T²,
 * so its relative error is twice the period's. Averaging trials divides it
 * by √trials. About ±3.4 for 30 swings timed once, ±2 for three trials.
 */
export function swingweightUncertainty(sw: number, periodS: number, swings: number, trials = 1, reactionS = 0.15): number {
  const dT = (reactionS * Math.SQRT2) / swings / Math.sqrt(trials)
  return sw * 2 * (dT / periodS)
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
