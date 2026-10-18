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

export interface SwingweightErrorInput {
  weightG: number
  balanceCm: number
  pivotCm: number
  /** The mean period of the trials counted. */
  periodS: number
  /** Full swings (there and back) timed in each trial. */
  swings: number
  trials: number
  /** How far off a balance point found on a ruler's edge can be. */
  balanceErrMm?: number
  /** A kitchen scale. */
  weightErrG?: number
  /** Starting and stopping the timer by hand, per trial. */
  reactionS?: number
}

export interface SwingweightError {
  /** All three together (in quadrature), in SW points. */
  total: number
  timing: number
  balance: number
  weight: number
}

/**
 * How far off a pendulum swingweight can honestly be. Three errors, added
 * in quadrature: the timing (the reaction time spread over the swings, and
 * divided by √trials), the balance point and the weight. The balance weighs
 * most: SW grows with d = balance − pivot, so ±2 mm of balance is about ±3
 * SW with the pivot at 10 cm. Each part is the central difference of
 * swingweightFromPeriod, so any pivot works.
 */
export function swingweightError({
  weightG,
  balanceCm,
  pivotCm,
  periodS,
  swings,
  trials,
  balanceErrMm = 2,
  weightErrG = 1,
  reactionS = 0.15,
}: SwingweightErrorInput): SwingweightError {
  const sw = (w: number, b: number, t: number) => swingweightFromPeriod(w, b, t, pivotCm)
  const half = (lo: number, hi: number) => Math.abs(hi - lo) / 2
  const dT = reactionS / swings / Math.sqrt(Math.max(1, trials))
  const dB = balanceErrMm / 10
  const timing = half(sw(weightG, balanceCm, periodS - dT), sw(weightG, balanceCm, periodS + dT))
  const balance = half(sw(weightG, balanceCm - dB, periodS), sw(weightG, balanceCm + dB, periodS))
  const weight = half(sw(weightG - weightErrG, balanceCm, periodS), sw(weightG + weightErrG, balanceCm, periodS))
  return { total: Math.hypot(timing, balance, weight), timing, balance, weight }
}

/**
 * Trials that look miscounted: a period more than `tolerance` (3%) away from
 * the median of all of them, which is about one swing too many or too few in
 * 20 to 30. Only with 3 trials or more, so there is a median to trust.
 */
export function oddTrials(periods: number[], tolerance = 0.03): number[] {
  if (periods.length < 3) return []
  const sorted = [...periods].sort((a, b) => a - b)
  const mid = sorted.length / 2
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
  return periods.flatMap((p, i) => (Math.abs(p - median) / median > tolerance ? [i] : []))
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
