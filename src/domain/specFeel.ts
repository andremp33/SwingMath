import { feelExact, type FeelFrame } from './feel'
import { DEFAULT_STRINGBED, openness } from './strings'
import type { Specs } from './types'

/**
 * Where a stock frame starts on power, control and spin (and touch, for the
 * map), from its own specs: head size, string pattern, stiffness (RA, when
 * the maker gives it), mass, balance and swingweight, through the same
 * physics as the feel (`feelExact`), plus what the maker says the line is
 * built for (Pure Aero for spin, Pure Strike for control...), worth
 * `LEAN_POINTS`. No playtest scores: every input is a published spec.
 *
 * Built to take players' ratings later: `community` is the per-model
 * aggregate of the journal's power, control and spin ratings (opt-in,
 * anonymous, on the same 5-95 scale), and moves the specs' estimate as
 * more players rate it. The specs count as `PRIOR_PLAYERS` players, so a
 * handful of ratings nudge it and many take over. n = 0 (or none) gives
 * the specs' estimate exactly.
 */

export type Lean = 'spin' | 'power' | 'control'

export interface StartFrame extends FeelFrame {
  /** What the maker builds the line for, if anything. */
  leans?: readonly Lean[]
}

export interface FeelStart {
  power: number
  control: number
  spin: number
  touch: number
}

/** Players' ratings of the model: how many, and their averages (5-95). */
export interface CommunityFeel {
  n: number
  power: number
  control: number
  spin: number
}

export const LEAN_POINTS = 8
export const PRIOR_PLAYERS = 8

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
const clamp = (v: number) => Math.max(5, Math.min(95, v))

/** The specs' estimate, before any players' ratings. `stock` is the frame
 *  as played stock: strings and an overgrip on, no lead. */
export function specFeel(stock: Specs, frame: StartFrame): FeelStart {
  const phys = feelExact(stock, frame, DEFAULT_STRINGBED)
  const lean = (k: Lean) => (frame.leans?.includes(k) ? LEAN_POINTS : 0)
  // Touch: a flexible frame, a dense bed and a head-light balance.
  const stiff = norm(frame.ra ?? 66, 58, 74)
  const open = openness(frame.headSizeSqIn, frame.pattern)
  const hl = norm(stock.ptsHL, 2, 10)
  const touch = 0.5 * (1 - stiff) + 0.3 * (1 - open) + 0.2 * hl
  return {
    power: clamp(phys.power + lean('power')),
    control: clamp(phys.control + lean('control')),
    spin: clamp(phys.spin + lean('spin')),
    touch: 5 + 90 * touch,
  }
}

/** The specs' estimate, moved towards players' ratings as they add up. */
export function startingFeel(stock: Specs, frame: StartFrame, community?: CommunityFeel): FeelStart {
  const prior = specFeel(stock, frame)
  const n = Math.max(0, community?.n ?? 0)
  if (!community || n === 0) return prior
  const blend = (p: number, c: number) => (PRIOR_PLAYERS * p + n * c) / (PRIOR_PLAYERS + n)
  return { ...prior, power: blend(prior.power, community.power), control: blend(prior.control, community.control), spin: blend(prior.spin, community.spin) }
}
