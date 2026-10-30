import { FEEL_KEYS, feelExact, type Feel } from '../domain/feel'
import { compute } from '../domain/physics'
import { DEFAULT_STRINGBED, type Stringbed } from '../domain/strings'
import { startingFeel, type FeelStart, type Lean } from '../domain/specFeel'
import { DEFAULT_ACCESSORY_MASSES, emptyLead, type AccessoryMasses, type Racket, type Specs } from '../domain/types'

/**
 * The feel of a frame as played: where a stock frame starts comes from its
 * specs and its line (domain/specFeel), and lead, strings and tension move
 * it from there by the physics. The player's own frames use the physics
 * alone.
 */

/** Lines the makers build and sell for one thing (spin: Pure Aero, VCORE,
 *  Extreme, SX; control: Prestige, Pure Strike, Percept...). */
const LINES: [brand: string, model: RegExp, leans: Lean[]][] = [
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
  ['Völkl', /V8|V-Cell 8/, ['power', 'spin']],
  ['Völkl', /V-Cell 10/, ['control']],
]

/** What the maker builds this stock frame's line for; nothing for the
 *  player's own frames, whose feel comes from the specs alone. */
export function leansOf(r: Pick<Racket, 'brand' | 'model' | 'isStock'>): Lean[] {
  if (!r.isStock) return []
  return LINES.filter(([b, m]) => b === r.brand && m.test(r.model)).flatMap(([, , l]) => l)
}

/** Where the stock frame sits on spin, power and control (and touch, for
 *  the map), from its specs and its line; nothing for the player's own. */
export function feelTarget(r: Racket, masses: AccessoryMasses = DEFAULT_ACCESSORY_MASSES): FeelStart | undefined {
  if (!r.isStock) return undefined
  return startingFeel(stockSpecs(r, masses), { ...r, leans: leansOf(r) })
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
 * How far the frame's start moves its power, control and spin from what the
 * physics alone gives its stock setup (its line, later players' ratings);
 * nothing for the player's own frames. The same for any lead or strings on
 * it, so whatever adds it (the feel, the goals) shows the same numbers and
 * the physics still moves them.
 */
export function feelOffset(r: Racket, masses: AccessoryMasses = DEFAULT_ACCESSORY_MASSES): Partial<Record<'power' | 'control' | 'spin', number>> {
  const target = feelTarget(r, masses)
  if (!target) return {}
  const stock = feelExact(stockSpecs(r, masses), r, DEFAULT_STRINGBED)
  return { power: target.power - stock.power, control: target.control - stock.control, spin: target.spin - stock.spin }
}

/**
 * The feel of `r` set up as `now` (lead, accessories) with `strings`: the
 * physics, moved so the stock frame lands where its start puts it.
 */
export function racketFeel(r: Racket, now: Specs, strings: Stringbed = DEFAULT_STRINGBED, masses: AccessoryMasses = DEFAULT_ACCESSORY_MASSES): Feel {
  const phys = feelExact(now, r, strings)
  const o = feelOffset(r, masses)
  const out = {} as Feel
  for (const k of FEEL_KEYS) out[k] = clamp(phys[k] + (o[k as keyof typeof o] ?? 0))
  return out
}
