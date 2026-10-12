import { feel, type Feel } from '../domain/feel'
import { compute } from '../domain/physics'
import { DEFAULT_STRINGBED, type Stringbed } from '../domain/strings'
import { DEFAULT_ACCESSORY_MASSES, emptyLead, type AccessoryMasses, type Racket, type Specs } from '../domain/types'
import { REVIEWS, type Review } from './reviews'

/**
 * The feel of a frame as played: where it starts comes from the playtests
 * (spin, power, control), and lead, strings and tension move it from there
 * by the physics. Frames with no review (the player's own) use the physics
 * alone.
 */

/** Lines the makers build for one thing, and players agree they do it
 *  (spin: Pure Aero, VCORE, Extreme, SX; control: Prestige, Pure Strike,
 *  Percept...). A small nudge on top of the scores. */
const LINES: [brand: string, model: RegExp, leans: ('spin' | 'power' | 'control')[]][] = [
  ['Babolat', /^Pure Aero/, ['spin']],
  ['Babolat', /^Pure Drive/, ['power']],
  ['Babolat', /^Pure Strike/, ['control']],
  ['Head', /Extreme/, ['spin', 'power']],
  ['Head', /Boom/, ['power']],
  ['Head', /Prestige|Gravity/, ['control']],
  ['Yonex', /^VCORE (9|1)/, ['spin']],
  ['Yonex', /VCORE Pro|Percept/, ['control']],
  ['Yonex', /EZONE/, ['power']],
  ['Wilson', /Blade|Pro Staff|RF/, ['control']],
  ['Wilson', /Ultra/, ['power']],
  ['Wilson', /Shift/, ['spin']],
  ['Dunlop', /SX/, ['spin']],
  ['Dunlop', /CX/, ['control']],
  ['Dunlop', /FX/, ['power']],
  ['Solinco', /Blackout/, ['power', 'spin']],
  ['Solinco', /Whiteout/, ['control']],
  ['Tecnifibre', /TF40|TFight/, ['control']],
  ['Prince', /Phantom|Textreme/, ['control']],
  ['Völkl', /V8|V-Cell 8/, ['power', 'spin']],
  ['Völkl', /V-Cell 10/, ['control']],
]

const keyOf = (r: Pick<Racket, 'brand' | 'model' | 'year'>) => `${r.brand}|${r.model}|${r.year ?? ''}`

/** The review that speaks for this frame, and the frame it was written for. */
export function reviewOf(r: Pick<Racket, 'brand' | 'model' | 'year'>): { review: Review; key: string; own: boolean } | undefined {
  const e = REVIEWS[keyOf(r)]
  if (!e) return undefined
  if ('like' in e) {
    const l = REVIEWS[e.like]
    return l && !('like' in l) ? { review: l, key: e.like, own: false } : undefined
  }
  return { review: e, key: keyOf(r), own: true }
}

const OWN = Object.values(REVIEWS).filter((e): e is Review => !('like' in e))
const stat = (pick: (r: Review) => number) => {
  const v = OWN.map(pick)
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  return { mean, sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1 }
}
const touchOf = (r: Review) => (r.touch === undefined ? r.comfort : (r.touch + r.comfort) / 2)
const STATS = { power: stat((r) => r.power), control: stat((r) => r.control), spin: stat((r) => r.topspin), touch: stat(touchOf) }

/** A playtest score on the 5-95 feel scale: the library's average sits at
 *  50, and each standard deviation is 16 points, so one-point differences
 *  between test teams do not swing it. */
const scale = (v: number, s: { mean: number; sd: number }, nudge = 0) => Math.max(8, Math.min(95, Math.round(50 + (16 * (v - s.mean)) / s.sd + nudge)))

/** Where the stock frame sits on spin, power and control (and touch, for
 *  the map), from its review and its line. */
export function feelTarget(r: Racket): { power: number; control: number; spin: number; touch: number } | undefined {
  const rev = reviewOf(r)
  if (!rev) return undefined
  const leans = LINES.filter(([b, m]) => b === r.brand && m.test(r.model)).flatMap(([, , l]) => l)
  const nudge = (k: 'spin' | 'power' | 'control') => (leans.includes(k) ? 8 : 0)
  const s = rev.review
  return {
    power: scale(s.power, STATS.power, nudge('power')),
    control: scale(s.control, STATS.control, nudge('control')),
    spin: scale(s.topspin, STATS.spin, nudge('spin')),
    touch: scale(touchOf(s), STATS.touch),
  }
}

/** The stock frame as tested: strings and an overgrip on, no lead. */
function stockSpecs(r: Racket, masses: AccessoryMasses): Specs {
  return compute({
    spec: r,
    baseMode: 'reference',
    measured: {},
    accessories: { strings: true, overgrip: true, leatherGrip: false, dampener: false },
    masses,
    leadG: emptyLead(),
  }).result
}

const clamp = (v: number) => Math.max(5, Math.min(95, Math.round(v)))

/**
 * The feel of `r` set up as `now` (lead, accessories) with `strings`: the
 * physics, moved so the stock frame lands where its playtest puts it.
 */
export function racketFeel(r: Racket, now: Specs, strings: Stringbed = DEFAULT_STRINGBED, masses: AccessoryMasses = DEFAULT_ACCESSORY_MASSES): Feel {
  const phys = feel(now, r, strings)
  const target = feelTarget(r)
  if (!target) return phys
  const stock = feel(stockSpecs(r, masses), r, DEFAULT_STRINGBED)
  return {
    ...phys,
    power: clamp(phys.power + target.power - stock.power),
    control: clamp(phys.control + target.control - stock.control),
    spin: clamp(phys.spin + target.spin - stock.spin),
  }
}
