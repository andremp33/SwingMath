import { openness } from './strings'
import { feelTarget, racketFeel } from '../data/racketFeel'
import { compute } from './physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead, type Racket } from './types'

/**
 * Where a frame sits on the racket map: from its playtest where it has one,
 * from its specs otherwise. x runs from control (−1) to power (+1), y from
 * touch (−1) to spin (+1). Played strung, with an overgrip.
 */
export interface MapPoint {
  x: number
  y: number
}

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

/** The raw scores, before they are spread over the library. */
export function mapScores(r: Racket): MapPoint {
  const { result } = compute({
    spec: r,
    baseMode: 'reference',
    measured: {},
    accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false },
    masses: DEFAULT_ACCESSORY_MASSES,
    leadG: emptyLead(),
  })
  // Frames with a playtest: its spin, power, control and touch. The player's
  // own frames: the specs alone.
  const f = racketFeel(r, result)
  const target = feelTarget(r)
  if (target) return { x: (f.power - f.control) / 100, y: (f.spin - target.touch) / 100 }
  const open = openness(r.headSizeSqIn, r.pattern)
  const stiff = norm(r.ra ?? 66, 58, 74)
  const head = norm(r.headSizeSqIn, 95, 105)
  const sw = norm(result.swingweight, 300, 345)
  const hl = norm(result.ptsHL, 2, 10)
  const power = 0.4 * head + 0.35 * stiff + 0.25 * sw
  const control = 0.35 * (1 - head) + 0.25 * (1 - open) + 0.2 * hl + 0.2 * (1 - stiff)
  const spin = 0.75 * (f.spin / 100) + 0.25 * open
  const touch = 0.5 * (1 - stiff) + 0.3 * (1 - open) + 0.2 * hl
  return { x: power - control, y: spin - touch }
}

/**
 * Places frames on the map relative to the library: each axis is centred on
 * the library's average and scaled by its spread, so the map uses its whole
 * area. Points stay inside the square, a little in from its edges.
 */
export function mapLayout(all: Racket[]): (r: Racket) => MapPoint {
  const raw = all.map(mapScores)
  const stat = (k: 'x' | 'y') => {
    const mean = raw.reduce((a, p) => a + p[k], 0) / raw.length
    const sd = Math.sqrt(raw.reduce((a, p) => a + (p[k] - mean) ** 2, 0) / raw.length) || 1
    return { mean, sd }
  }
  const sx = stat('x')
  const sy = stat('y')
  return (r) => {
    const p = mapScores(r)
    const clamp = (v: number) => Math.max(-0.93, Math.min(0.93, v))
    return { x: clamp((p.x - sx.mean) / (2.2 * sx.sd)), y: clamp((p.y - sy.mean) / (2.2 * sy.sd)) }
  }
}
