/**
 * Pro players' racket specs, as targets. Only numbers with a clear origin go
 * here: a measurement by a named source, or the maker's own version of the
 * player's frame. Most published "pro specs" are copied from site to site
 * with no measurement behind them; those stay out.
 */
export interface ProTarget {
  id: 'nadal' | 'sinner'
  player: string
  racket: string
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
    strung: true,
    weightG: 337,
    balanceCm: 33.99,
    swingweight: 371,
    source: 'Tennis Warehouse',
    url: 'https://www.tennis-warehouse.com/learning_center/racquet_reviews/BARORreview.html',
  },
  {
    id: 'sinner',
    player: 'Jannik Sinner',
    racket: 'Head Speed (pro stock)',
    strung: false,
    weightG: 302,
    balanceCm: 32.3,
    swingweight: 296,
    source: 'Tennisnerd',
    url: 'https://www.tennisnerd.net/gear/racquets/pro-player-racquets/jannik-sinners-racquet/23204',
  },
]
