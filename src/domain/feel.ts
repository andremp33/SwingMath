import type { Specs } from './types'

export const FEEL_KEYS = ['power', 'stability', 'manoeuvrability', 'spin', 'control', 'plow'] as const
export type FeelKey = (typeof FEEL_KEYS)[number]
export type Feel = Record<FeelKey, number>

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

/**
 * Our own feel heuristic. Not a measurement: a transparent mix of the specs
 * that drive each sensation, scaled to 5-95 %. The formulas are shown to the
 * user in the info sheet, so keep this file and the copy in sync.
 */
export function feel(s: Specs, headSizeSqIn: number, ra = 66): Feel {
  const sw = norm(s.swingweight, 270, 360)
  const m = norm(s.weightG, 270, 370)
  const tw = norm(s.twistweight ?? 0.135 * headSizeSqIn, 11, 17)
  const rw = norm(s.recoilWeight, 135, 195)
  const hl = norm(s.ptsHL, 0, 10)
  const head = norm(headSizeSqIn, 93, 110)
  const stiff = norm(ra, 58, 74)

  const raw: Feel = {
    power: 0.55 * sw + 0.2 * stiff + 0.15 * head + 0.1 * m,
    stability: 0.4 * tw + 0.3 * m + 0.3 * rw,
    manoeuvrability: 0.65 * (1 - sw) + 0.2 * hl + 0.15 * (1 - m),
    spin: 0.45 * (1 - sw) + 0.3 * head + 0.25 * (1 - m),
    control: 0.35 * m + 0.25 * (1 - head) + 0.2 * hl + 0.2 * (1 - stiff),
    plow: 0.6 * sw + 0.4 * m,
  }
  const out = {} as Feel
  for (const k of FEEL_KEYS) out[k] = Math.round(5 + 90 * raw[k])
  return out
}
