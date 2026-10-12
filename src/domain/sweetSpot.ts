import { compute, type ComputeInput } from './physics'
import type { ExtraLead } from './types'

/**
 * How lead moves the sweet spot (the centre of percussion for the 10 cm
 * axis: the impact that sends no shock to the hand). With q its distance
 * from the axis, mass added at r from the axis raises it when r > q or r < 0
 * and lowers it when 0 < r < q: lead above the sweet spot pulls it up, lead
 * between the hand and the sweet spot pulls it down, lead below the hand
 * nudges it up. At the sweet spot's own height (near 3 and 9) it barely
 * moves, but twistweight grows, so it gets wider. Same rule for every frame;
 * the sizes depend on the frame, so they are computed for the player's.
 */
export type ProbeKey = 'tip' | 'tenTwo' | 'threeNine' | 'fourEight' | 'throat' | 'handle'

export const PROBES: Record<ProbeKey, Omit<ExtraLead, 'id' | 'grams'>> = {
  tip: { kind: 'hoop', hour: 0, sides: 1 },
  tenTwo: { kind: 'hoop', hour: 2, sides: 2 },
  threeNine: { kind: 'hoop', hour: 3, sides: 2 },
  fourEight: { kind: 'hoop', hour: 4, sides: 2 },
  throat: { kind: 'hoop', hour: 6, sides: 1 },
  handle: { kind: 'shaft', cm: 6, sides: 1 },
}

export interface SweetSpotEffect {
  key: ProbeKey
  /** How far the sweet spot moves, in mm (up the frame is positive). */
  mm: number
  /** Twistweight change in %: how much wider it gets. */
  widerPct: number
  swingweight: number
}

/** What `grams` more at each spot would do to this setup. */
export function sweetSpotEffects(input: ComputeInput, grams = 5): SweetSpotEffect[] {
  const now = compute(input).result
  return (Object.keys(PROBES) as ProbeKey[]).map((key) => {
    const probe: ExtraLead = { id: 'probe', grams, ...PROBES[key] }
    const r = compute({ ...input, extra: [...(input.extra ?? []), probe] }).result
    const tw0 = now.twistweight ?? 0
    return {
      key,
      mm: (r.sweetSpotCm - now.sweetSpotCm) * 10,
      widerPct: tw0 ? (((r.twistweight ?? tw0) - tw0) / tw0) * 100 : 0,
      swingweight: r.swingweight - now.swingweight,
    }
  })
}
