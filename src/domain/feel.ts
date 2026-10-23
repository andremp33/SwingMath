import { BED_SOFT, BED_STIFF, DEFAULT_STRINGBED, MATERIAL, openness, stringbedIndex, type FrameForStrings, type Stringbed } from './strings'
import type { Specs } from './types'

export const FEEL_KEYS = ['power', 'stability', 'manoeuvrability', 'spin', 'control', 'plow'] as const
export type FeelKey = (typeof FEEL_KEYS)[number]
export type Feel = Record<FeelKey, number>

/** What the feel needs to know about the frame besides its mass properties. */
export interface FeelFrame extends FrameForStrings {
  /** Frame stiffness (RA). */
  ra?: number
}

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

/**
 * Our own feel heuristic. Not a measurement: a transparent mix of the specs
 * that drive each sensation, scaled to 5-95 %. The formulas are shown to the
 * user in the info sheet, so keep this file and the copy in sync.
 *
 * Power, spin and control also depend on the stringbed. From Tennis
 * Warehouse University's tests: open patterns let the mains slide and snap
 * back, so they give more spin (16x15 about 10 % more than 16x19 with the
 * same string, more than poly over nylon gives) and a higher launch; dense
 * ones (18x20) launch flatter and steer better; a stiffer bed (more strings,
 * more tension, stiffer string) returns a little less energy and controls
 * more. The frame still weighs most.
 */
export function feel(s: Specs, frame: FeelFrame, strings: Stringbed = DEFAULT_STRINGBED): Feel {
  const exact = feelExact(s, frame, strings)
  const out = {} as Feel
  for (const k of FEEL_KEYS) out[k] = Math.round(exact[k])
  return out
}

/** The feel before rounding: small changes (a few grams) still show. */
export function feelExact(s: Specs, frame: FeelFrame, strings: Stringbed = DEFAULT_STRINGBED): Feel {
  const sw = norm(s.swingweight, 270, 360)
  const m = norm(s.weightG, 270, 370)
  const tw = norm(s.twistweight ?? 0.135 * frame.headSizeSqIn, 11, 17)
  const rw = norm(s.recoilWeight, 135, 195)
  const hl = norm(s.ptsHL, 0, 10)
  const head = norm(frame.headSizeSqIn, 93, 110)
  const stiff = norm(frame.ra ?? 66, 58, 74)

  // The stringbed: how stiff (pattern, tension, string) and how open it is.
  const bed = norm(stringbedIndex(frame, strings), BED_SOFT, BED_STIFF)
  const open = openness(frame.headSizeSqIn, frame.pattern)
  const snap = MATERIAL[strings.mains.material].snapback

  const raw: Feel = {
    power: 0.85 * (0.55 * sw + 0.2 * stiff + 0.15 * head + 0.1 * m) + 0.15 * (0.6 * (1 - bed) + 0.4 * open),
    stability: 0.4 * tw + 0.3 * m + 0.3 * rw,
    manoeuvrability: 0.65 * (1 - sw) + 0.2 * hl + 0.15 * (1 - m),
    spin: 0.7 * (0.45 * (1 - sw) + 0.3 * head + 0.25 * (1 - m)) + 0.3 * (0.5 * open + 0.3 * snap + 0.2 * (1 - bed)),
    control: 0.8 * (0.35 * m + 0.25 * (1 - head) + 0.2 * hl + 0.2 * (1 - stiff)) + 0.2 * (0.6 * bed + 0.4 * (1 - open)),
    plow: 0.6 * sw + 0.4 * m,
  }
  const out = {} as Feel
  for (const k of FEEL_KEYS) out[k] = 5 + 90 * raw[k]
  return out
}
