import { armComfort } from './comfort'
import { feelExact, type FeelFrame } from './feel'
import { compute, type ComputeInput } from './physics'
import { DEFAULT_STRINGBED, type Stringbed } from './strings'
import { PROBES, type ProbeKey } from './sweetSpot'
import type { Specs } from './types'

/** What a player can want more of: the feel's keys (but plow) and arm comfort. */
export const GOAL_KEYS = ['stability', 'power', 'manoeuvrability', 'spin', 'control', 'comfort'] as const
export type GoalKey = (typeof GOAL_KEYS)[number]

/** One change to try: lead at one of the sweet spot's spots, or the tension. */
export type GoalMove = { kind: 'lead'; probe: ProbeKey; grams: number } | { kind: 'tension'; kg: number }

export interface GoalAdvice {
  goal: GoalKey
  /** 5-95, as the feel shows it (comfort: the arm comfort score). */
  now: number
  /** The change that raises it most, and the goal it costs most, if any.
   *  None when no change raises it by a point. */
  best?: { move: GoalMove; gain: number; cost?: { goal: GoalKey; delta: number } }
}

export interface GoalInput extends ComputeInput {
  spec: ComputeInput['spec'] & FeelFrame
  strings?: Stringbed
  /** Where the frame's start moves the feel (data/racketFeel's
   *  feelOffset), so the goals read as the feel does. */
  feelOffset?: Partial<Record<GoalKey, number>>
}

const within = (v: number) => Math.max(5, Math.min(95, v))

/** Each goal for these specs and strings, 5-95, unrounded. */
export function goalScores(s: Specs, frame: FeelFrame, bed: Stringbed, offset: Partial<Record<GoalKey, number>> = {}): Record<GoalKey, number> {
  const f = feelExact(s, frame, bed)
  const c = armComfort(s, frame, bed)
  const at = (k: Exclude<GoalKey, 'comfort'>) => within(f[k] + (offset[k] ?? 0))
  return {
    stability: at('stability'),
    power: at('power'),
    manoeuvrability: at('manoeuvrability'),
    spin: at('spin'),
    control: at('control'),
    comfort: 5 + 90 * c.factors.reduce((sum, x) => sum + x.weight * x.value, 0),
  }
}

/** Grams of lead per try: the sweet spot card's probe. */
export const GOAL_GRAMS = 5
/** Kilos of tension per try, mains and crosses together. */
export const GOAL_KG = 2
const TENSION_RANGE = [15, 30]

const withTension = (bed: Stringbed, kg: number): Stringbed => ({
  mains: { ...bed.mains, tensionKg: bed.mains.tensionKg + kg },
  ...(bed.crosses && { crosses: { ...bed.crosses, tensionKg: bed.crosses.tensionKg + kg } }),
})

/**
 * For each goal, the single change that raises it most: GOAL_GRAMS of lead
 * at one of the sweet spot card's spots, or GOAL_KG more or less tension.
 * Differences of the feel heuristic, so they hold for stock frames too (the
 * frame's start only shifts where the feel begins). The cost is the goal that
 * drops most with it, so the player sees what they trade.
 */
export function goalAdvice(input: GoalInput, goals: readonly GoalKey[]): GoalAdvice[] {
  const bed = input.strings ?? DEFAULT_STRINGBED
  const frame = input.spec
  const offset = input.feelOffset ?? {}
  const specs = compute(input).result
  const now = goalScores(specs, frame, bed, offset)

  const moves: { move: GoalMove; scores: Record<GoalKey, number> }[] = (Object.keys(PROBES) as ProbeKey[]).map((probe) => {
    const lead = { id: 'probe', grams: GOAL_GRAMS, ...PROBES[probe] }
    const r = compute({ ...input, extra: [...(input.extra ?? []), lead] }).result
    return { move: { kind: 'lead', probe, grams: GOAL_GRAMS }, scores: goalScores(r, frame, bed, offset) }
  })
  for (const kg of [-GOAL_KG, GOAL_KG]) {
    const tension = bed.mains.tensionKg + kg
    if (tension < TENSION_RANGE[0] || tension > TENSION_RANGE[1]) continue
    moves.push({ move: { kind: 'tension', kg }, scores: goalScores(specs, frame, withTension(bed, kg), offset) })
  }

  return goals.map((goal) => {
    const ranked = moves.map((m) => ({ ...m, gain: m.scores[goal] - now[goal] })).sort((a, b) => b.gain - a.gain)
    const top = ranked[0]
    if (!top || top.gain < 0.5) return { goal, now: now[goal] }
    const drops = GOAL_KEYS.filter((k) => k !== goal)
      .map((k) => ({ goal: k, delta: top.scores[k] - now[k] }))
      .sort((a, b) => a.delta - b.delta)
    const cost = drops[0] && drops[0].delta <= -0.5 ? drops[0] : undefined
    return { goal, now: now[goal], best: { move: top.move, gain: top.gain, cost } }
  })
}

export type LevelKey = 'beginner' | 'intermediate' | 'advanced' | 'competition'

/**
 * Strung swingweight most players at each level swing comfortably, kg·cm².
 * A rough guide from what is commonly played (club frames sit around
 * 310-325, tour players well above 330), not a rule: technique and
 * fitness matter more than the label.
 */
export const SW_BY_LEVEL: Record<LevelKey, [number, number]> = {
  beginner: [290, 310],
  intermediate: [305, 322],
  advanced: [315, 332],
  competition: [325, 350],
}

/** Where a swingweight sits against the level's usual range. */
export function swingweightForLevel(sw: number, level: LevelKey): 'below' | 'within' | 'above' {
  const [lo, hi] = SW_BY_LEVEL[level]
  return sw < lo ? 'below' : sw > hi ? 'above' : 'within'
}
