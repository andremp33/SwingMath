import type { MatchResult, Target } from './match'
import type { Base } from './physics'

/**
 * Free plans of the solver. A use is a new plan, told apart by where it
 * starts and what it aims at, and it counts only once the solver has given
 * a result. Solving the same plan again (other positions, another limit per
 * position, the typed target fine-tuned) is free. Past the free plans, a new
 * plan still shows its diagnosis; only the lead per position is Pro.
 */
export const FREE_PLANS = 3

/** Hit a target: the start (its source) and where the target comes from
 *  (a pro's id, a racquet's or setup's id, or "typed" for numbers typed in). */
export const targetPlanKey = (from: string, target: string) => `target|${from}|${target}`

/** Match racquets: the racquets, in any order. */
export const matchPlanKey = (racketIds: string[]) => `match|${[...racketIds].sort().join(',')}`

export const freePlansLeft = (plans: string[]) => Math.max(0, FREE_PLANS - plans.length)

export interface PlanAccess {
  /** The whole plan, or only its diagnosis. */
  full: boolean
  /** A new plan that takes one of the free ones (once it has a result). */
  spends: boolean
}

export function planAccess(plans: string[], key: string, pro: boolean): PlanAccess {
  if (pro || plans.includes(key)) return { full: true, spends: false }
  if (plans.length < FREE_PLANS) return { full: true, spends: true }
  return { full: false, spends: false }
}

/** The free plans after a plan with a result. */
export const withPlan = (plans: string[], key: string) => (plans.includes(key) ? plans : [...plans, key])

export interface Diagnosis {
  /** What the target asks on top of the start: g, mm of balance, SW. */
  missing: { weightG?: number; balanceMm?: number; swingweight?: number }
  /** Reached with lead within the limit per position. */
  reachable: boolean
  /** The specs the plan leads to. */
  final: { weightG: number; balanceCm: number; swingweight: number }
}

/** A match this close or closer counts as reaching the target. */
export const REACHED_PCT = 95

/** What a plan says without its lead per position. */
export function diagnose(base: Base, target: Target, res: MatchResult): Diagnosis {
  const missing: Diagnosis['missing'] = {}
  if (target.weightG !== undefined) missing.weightG = target.weightG - base.weightG
  if (target.balanceCm !== undefined) missing.balanceMm = (target.balanceCm - base.balanceCm) * 10
  if (target.swingweight !== undefined) missing.swingweight = target.swingweight - base.swingweight
  return {
    missing,
    reachable: res.unreachable.length === 0 && res.matchPct >= REACHED_PCT,
    final: { weightG: res.result.weightG, balanceCm: res.result.balanceCm, swingweight: res.result.swingweight },
  }
}
