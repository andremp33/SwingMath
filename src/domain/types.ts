export const POSITIONS = ['tip', 'tenTwo', 'threeNine', 'throat', 'handle'] as const
export type Position = (typeof POSITIONS)[number]
export type LeadMap = Record<Position, number>

export const STROKES = ['forehand', 'backhand', 'serve', 'volley'] as const
export type Stroke = (typeof STROKES)[number]

export type RacketType = 'power' | 'control' | 'tweener' | 'junior'

/** Static specs of a frame. Weight in g, lengths in cm, SW/TW in kg·cm². */
export interface RacketSpec {
  lengthCm: number
  headSizeSqIn: number
  weightG: number
  balanceCm: number
  swingweight: number
  twistweight?: number
  ra?: number
}

export interface Racket extends RacketSpec {
  id: string
  brand: string
  model: string
  year?: number
  type: RacketType
  isStock: boolean
  /** Where the numbers come from (a URL for stock frames), shown to the user. */
  source?: string
  pattern?: string
  /** Strung measurements the stock values were derived from. */
  strung?: { weightG: number; balanceCm: number; swingweight: number }
  createdAt: number
  updatedAt: number
}

export interface Accessories {
  strings: boolean
  leatherGrip: boolean
  overgrip: boolean
  dampener: boolean
}

export interface AccessoryMasses {
  strings: number
  leatherGrip: number
  overgrip: number
  dampener: number
}

export type BaseMode = 'reference' | 'measured'

export interface Measured {
  weightG?: number
  balanceCm?: number
  swingweight?: number
  twistweight?: number
}

/**
 * Lead anywhere else on the frame.
 * hoop: on the head, at a clock hour (12 = tip, 3 = right side, 6 = bottom of
 *   the head), on one side or mirrored on both (the grams are the total).
 * shaft: on the centre line, at a distance from the butt (handle, throat).
 */
export interface ExtraLead {
  id: string
  kind: 'hoop' | 'shaft'
  /** Clock hour, 0.5 to 11.5 in half hours (hoop). */
  hour?: number
  /** Distance from the butt in cm (shaft). */
  cm?: number
  sides: 1 | 2
  grams: number
}

export interface SetupConfig {
  racketId: string
  baseMode: BaseMode
  measured: Measured
  accessories: Accessories
  leadG: LeadMap
  extra?: ExtraLead[]
}

export interface Setup extends SetupConfig {
  id: string
  name: string
  favourite: boolean
  ratings: Partial<Record<Stroke, number>>
  notes?: string
  createdAt: number
  updatedAt: number
}

/** Computed specs after changes. */
export interface Specs {
  weightG: number
  balanceCm: number
  ptsHL: number
  swingweight: number
  twistweight?: number
  /** True when twistweight was estimated from head size, not given. */
  twistweightEstimated?: boolean
  recoilWeight: number
  /** Centre of percussion, cm from the butt. */
  sweetSpotCm: number
}

export const emptyLead = (): LeadMap => ({ tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 })

export const DEFAULT_ACCESSORY_MASSES: AccessoryMasses = {
  strings: 17,
  leatherGrip: 10,
  overgrip: 6,
  dampener: 2,
}
