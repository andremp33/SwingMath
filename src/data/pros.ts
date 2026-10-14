import { accessoryElements, applyMasses, geometry } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'

/**
 * Pro players' racket specs, as targets. Only numbers with an identifiable
 * origin go here, and the screen shows it, with its date:
 *
 * - `measured`: a lab (the maker's version of the player's frame), or a named
 *   stringer, shop or writer who measured the player's own racket;
 * - `reported`: the maker or a named publication, in a given article.
 *
 * Most published "pro specs" are copied from site to site with no
 * measurement behind them, or come from forum posts; those stay out (the
 * list of who was left out and why is in the commit that added this).
 * Setups change: `date` is when the numbers were measured or published.
 */
export interface ProTarget {
  id: string
  player: string
  tour: 'ATP' | 'WTA'
  racket: string
  headSizeSqIn: number
  lengthCm: number
  /** Measured with strings on, or as a bare frame. */
  strung: boolean
  weightG: number
  balanceCm: number
  swingweight: number
  evidence: 'measured' | 'reported'
  /** Who measured or published them. */
  source: string
  url: string
  /** YYYY-MM. */
  date: string
  /** The library's stock version of the frame, to start from. */
  baseRacketId?: string
  /** Only when the source says. */
  strings?: { name: string; tension?: string }
}

export const PRO_TARGETS: ProTarget[] = [
  {
    id: 'sinner',
    player: 'Jannik Sinner',
    tour: 'ATP',
    racket: 'Head Speed (pro stock TGT 301.4)',
    headSizeSqIn: 100,
    lengthCm: 68.5,
    strung: false,
    weightG: 302,
    balanceCm: 32.3,
    swingweight: 296,
    evidence: 'measured',
    source: 'Tennisnerd (Jonas Eriksson), ATP Vienna',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/jannik-sinners-racquet/23204',
    date: '2025-10',
    baseRacketId: 'stock-head-speed-mp-2026',
    strings: { name: 'Head Hawk Touch 1.30', tension: '28 kg' },
  },
  {
    id: 'djokovic',
    player: 'Novak Djokovic',
    tour: 'ATP',
    racket: 'Head Speed Pro (pro stock)',
    headSizeSqIn: 95,
    lengthCm: 68.83,
    strung: true,
    weightG: 353,
    balanceCm: 32.4,
    swingweight: 360,
    evidence: 'measured',
    source: 'Tennisnerd (Jonas Eriksson), one of his personal racquets',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/novak-djokovics-tennis-racquet/2935',
    date: '2026-07',
    baseRacketId: 'stock-head-speed-pro-2026',
    strings: { name: 'Natural gut / Luxilon ALU Power Rough 1.25', tension: '27–28 / 26–27 kg' },
  },
  {
    id: 'nadal',
    player: 'Rafael Nadal',
    tour: 'ATP',
    racket: 'Babolat Pure Aero Rafa Origin',
    headSizeSqIn: 100,
    lengthCm: 68.58,
    strung: true,
    weightG: 337,
    balanceCm: 33.99,
    swingweight: 371,
    evidence: 'measured',
    source: 'Tennis Warehouse (lab)',
    url: 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/BARORreview.html',
    date: '2023-06',
    baseRacketId: 'stock-babolat-pure-aero-rafa-origin-2023',
  },
  {
    id: 'federer',
    player: 'Roger Federer',
    tour: 'ATP',
    racket: 'Wilson Pro Staff RF97 Autograph',
    headSizeSqIn: 97,
    lengthCm: 68.58,
    strung: true,
    weightG: 357,
    balanceCm: 31.45,
    swingweight: 335,
    evidence: 'measured',
    source: 'Tennis Warehouse (lab)',
    url: 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/PSRF97review.html',
    date: '2016-08',
  },
  {
    id: 'vandezandschulp',
    player: 'Botic van de Zandschulp',
    tour: 'ATP',
    racket: 'Babolat Pure Aero (2019)',
    headSizeSqIn: 100,
    lengthCm: 68.58,
    strung: false,
    weightG: 316,
    balanceCm: 31.2,
    swingweight: 303,
    evidence: 'measured',
    source: 'Prostringing (his stringer), via Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/some-pro-player-racquet-specs/31515',
    date: '2023-06',
    baseRacketId: 'stock-babolat-pure-aero-2019',
  },
  {
    id: 'seybothwild',
    player: 'Thiago Seyboth Wild',
    tour: 'ATP',
    racket: 'Wilson H22 (pro stock)',
    headSizeSqIn: 97,
    lengthCm: 68.58,
    strung: true,
    weightG: 364,
    balanceCm: 32.4,
    swingweight: 358,
    evidence: 'measured',
    source: 'Raquetes E Cia (shop), via Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/some-pro-player-racquet-specs/31515',
    date: '2023-06',
    strings: { name: 'Luxilon 4G' },
  },
  {
    id: 'swiatek',
    player: 'Iga Świątek',
    tour: 'WTA',
    racket: 'Tecnifibre Tempo 298 IGA',
    headSizeSqIn: 100,
    lengthCm: 68.58,
    strung: true,
    // 11.1 oz, 4 pts head light.
    weightG: 315,
    balanceCm: 33.02,
    swingweight: 320,
    evidence: 'reported',
    source: 'Tennis.com (Jon Levey)',
    url: 'https://www.tennis.com/news/articles/signature-stick-iga-swiatek-plays-with-a-style-and-a-racquet-all-her-own',
    date: '2023-07',
  },
  {
    id: 'sabalenka',
    player: 'Aryna Sabalenka',
    tour: 'WTA',
    racket: 'Wilson Blade 98 18x20 (2021)',
    headSizeSqIn: 98,
    lengthCm: 68.58,
    strung: true,
    weightG: 324,
    balanceCm: 32.7,
    swingweight: 326,
    evidence: 'reported',
    source: 'Tan Tennis, via Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/aryna-sabalenkas-racquet/24697',
    date: '2021-05',
    baseRacketId: 'stock-wilson-blade-98-18x20-v8-2021',
  },
  {
    id: 'serenawilliams',
    player: 'Serena Williams',
    tour: 'WTA',
    racket: 'Wilson BLX Blade 104 (match-used, 2013)',
    headSizeSqIn: 104,
    lengthCm: 69.85,
    strung: true,
    weightG: 330,
    balanceCm: 34,
    swingweight: 366,
    evidence: 'reported',
    source: 'Tennisnerd, from a match-used racquet sold by Pro Stock Tennis',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/serena-williams-racquet/15691',
    date: '2019-11',
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
