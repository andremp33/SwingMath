import { MATERIAL, stringbedIndex, type FrameForStrings, type Stringbed } from './strings'
import type { Specs } from './types'

export const COMFORT_FACTORS = ['ra', 'weight', 'balance', 'stringbed', 'material'] as const
export type ComfortFactor = (typeof COMFORT_FACTORS)[number]

export interface Comfort {
  /** 5-95: higher is kinder to the arm. */
  score: number
  /** Each factor 0-1 (1 = best for the arm), weakest first. */
  factors: { key: ComfortFactor; value: number; weight: number }[]
}

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

const WEIGHTS: Record<ComfortFactor, number> = { ra: 0.3, weight: 0.2, material: 0.2, balance: 0.15, stringbed: 0.15 }

/**
 * Arm comfort, our own heuristic for players with sore elbows or shoulders.
 * What the advice from coaches and physios agrees on: a flexible frame (low
 * RA), more mass to absorb the impact, head-light balance (less shock at the
 * hand), soft strings and a soft stringbed.
 */
export function armComfort(s: Specs, frame: FrameForStrings & { ra?: number }, bed: Stringbed): Comfort {
  const crosses = bed.crosses ?? bed.mains
  const values: Record<ComfortFactor, number> = {
    ra: norm(72 - (frame.ra ?? 66), 0, 17),
    weight: norm(s.weightG, 285, 345),
    balance: norm(s.ptsHL, -2, 8),
    stringbed: norm(120 - stringbedIndex(frame, bed), 0, 35),
    material: (MATERIAL[bed.mains.material].comfort + MATERIAL[crosses.material].comfort) / 2,
  }
  const raw = COMFORT_FACTORS.reduce((sum, k) => sum + WEIGHTS[k] * values[k], 0)
  return {
    score: Math.round(5 + 90 * raw),
    factors: COMFORT_FACTORS.map((key) => ({ key, value: values[key], weight: WEIGHTS[key] })).sort(
      // Weakest first, by how many points each could still add.
      (a, b) => b.weight * (1 - b.value) - a.weight * (1 - a.value),
    ),
  }
}
