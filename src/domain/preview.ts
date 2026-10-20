import { solveTarget, TOLERANCE, type MatchResult, type Target, type TargetKey } from './match'
import type { Base } from './physics'
import { POSITIONS, type LeadMap, type Position } from './types'

/**
 * The paywall's preview: the player's racket, the strips of lead that take
 * it to a pro's, and how many. The grams stay out of it (they are what Pro
 * sells); the strips only say how far.
 */

/** One strip of lead tape, about a gram. */
export const STRIP_G = 1

/** Positions on both sides of the head carry the same lead on each. */
export const SIDES: Record<Position, 1 | 2> = { tip: 1, tenTwo: 2, threeNine: 2, throat: 1, handle: 1 }

export interface Strip {
  position: Position
  /** 0, or 1 for the second side of a split position. */
  side: 0 | 1
  /** Its place in the stack at that spot, from the frame in. */
  layer: number
}

/** The strips a plan puts on, head to handle, both sides of a split
 *  position in turn: whole strips, a part of one counting as one. */
export function leadStrips(lead: LeadMap): Strip[] {
  const out: Strip[] = []
  for (const position of POSITIONS) {
    const sides = SIDES[position]
    const each = Math.ceil(lead[position] / sides / STRIP_G - 1e-9)
    for (let layer = 0; layer < each; layer++) for (let side = 0; side < sides; side++) out.push({ position, side: side as 0 | 1, layer })
  }
  return out
}

/** How far a racket is from a target, the solver's tolerances as units.
 *  A target below it in weight or swingweight cannot be reached with lead,
 *  so it only counts when nothing else can. */
export function distanceTo(specs: Target, target: Target): number {
  let d = 0
  for (const k of ['weightG', 'balanceCm', 'swingweight'] as TargetKey[]) {
    if (specs[k] === undefined || target[k] === undefined) continue
    d += ((target[k]! - specs[k]!) / (10 * TOLERANCE[k])) ** 2
  }
  const below = (target.weightG ?? Infinity) < specs.weightG! - TOLERANCE.weightG || (target.swingweight ?? Infinity) < specs.swingweight! - TOLERANCE.swingweight
  return below ? d + 1e6 : d
}

/** The target nearest to the racket that lead can reach (any, if none can). */
export function nearestTarget<T extends { id: string; specs: Target }>(specs: Target, targets: T[]): T | undefined {
  return [...targets].sort((a, b) => distanceTo(specs, a.specs) - distanceTo(specs, b.specs))[0]
}

export interface RacketPreview {
  plan: MatchResult
  strips: Strip[]
  /** Swingweight before and after the plan. */
  fromSw: number
  toSw: number
}

/** The plan from the player's racket to the target, as strips. Null when
 *  lead cannot get there (the racket is already heavier). */
export function racketPreview(base: Base, target: Target, maxPerPositionG?: number): RacketPreview | null {
  const plan = solveTarget(base, target, { maxPerPositionG })
  if (plan.unreachable.length) return null
  return { plan, strips: leadStrips(plan.lead), fromSw: base.swingweight, toSw: plan.result.swingweight }
}
