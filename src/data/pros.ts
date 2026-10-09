import { accessoryElements, applyMasses, geometry } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'

/**
 * Pro players' racket specs, as targets. Only numbers with a clear origin go
 * here: a lab measurement of the maker's version of the player's frame, or a
 * measurement by a named stringer, shop or writer. Most published "pro specs"
 * are copied from site to site with no measurement behind them; those stay
 * out (Fils: weight only; Zverev, Medvedev: no named source).
 */
export interface ProTarget {
  id: 'nadal' | 'federer' | 'sinner' | 'vandezandschulp' | 'seybothwild'
  player: string
  racket: string
  headSizeSqIn: number
  lengthCm: number
  /** Measured with strings on, or as a bare frame. */
  strung: boolean
  weightG: number
  balanceCm: number
  swingweight: number
  source: string
  url: string
}

export const PRO_TARGETS: ProTarget[] = [
  {
    id: 'nadal',
    player: 'Rafael Nadal',
    racket: 'Babolat Pure Aero Rafa Origin',
    headSizeSqIn: 100,
    lengthCm: 68.58,
    strung: true,
    weightG: 337,
    balanceCm: 33.99,
    swingweight: 371,
    source: 'Tennis Warehouse',
    url: 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/BARORreview.html',
  },
  {
    id: 'federer',
    player: 'Roger Federer',
    racket: 'Wilson Pro Staff RF97 Autograph',
    headSizeSqIn: 97,
    lengthCm: 68.58,
    strung: true,
    weightG: 357,
    balanceCm: 31.45,
    swingweight: 335,
    source: 'Tennis Warehouse',
    url: 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/PSRF97review.html',
  },
  {
    id: 'sinner',
    player: 'Jannik Sinner',
    racket: 'Head Speed (pro stock TGT 301.4)',
    headSizeSqIn: 100,
    lengthCm: 68.5,
    strung: false,
    weightG: 302,
    balanceCm: 32.3,
    swingweight: 296,
    source: 'Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/jannik-sinners-racquet/23204',
  },
  {
    id: 'vandezandschulp',
    player: 'Botic van de Zandschulp',
    racket: 'Babolat Pure Aero (2019)',
    headSizeSqIn: 100,
    lengthCm: 68.58,
    strung: false,
    weightG: 316,
    balanceCm: 31.2,
    swingweight: 303,
    source: 'Prostringing, via Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/some-pro-player-racquet-specs/31515',
  },
  {
    id: 'seybothwild',
    player: 'Thiago Seyboth Wild',
    racket: 'Wilson H22 (pro stock)',
    headSizeSqIn: 97,
    lengthCm: 68.58,
    strung: true,
    weightG: 364,
    balanceCm: 32.4,
    swingweight: 358,
    source: 'Raquetes E Cia, via Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/some-pro-player-racquet-specs/31515',
  },
]

export interface PlainSpecs {
  weightG: number
  balanceCm: number
  swingweight: number
}

/**
 * The same frame strung or unstrung, with the app's string model, so a
 * target is compared in the same state as the starting point.
 */
export function withStrings(frame: { headSizeSqIn: number; lengthCm: number }, s: PlainSpecs, from: boolean, to: boolean): PlainSpecs {
  if (from === to) return s
  const g = geometry(frame.lengthCm, frame.headSizeSqIn)
  const [strings] = accessoryElements(g, { strings: true, leatherGrip: false, overgrip: false, dampener: false }, DEFAULT_ACCESSORY_MASSES)
  const own = (strings.ownSwing ?? 0) / 1000
  const add = (strings.grams * (strings.x - 10) ** 2) / 1000 + own
  if (to) {
    const r = applyMasses({ ...frame, ...s }, [strings])
    return { weightG: r.weightG, balanceCm: r.balanceCm, swingweight: r.swingweight }
  }
  const weightG = s.weightG - strings.grams
  return { weightG, balanceCm: (s.weightG * s.balanceCm - strings.grams * strings.x) / weightG, swingweight: s.swingweight - add }
}
