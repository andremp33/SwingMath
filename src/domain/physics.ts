import {
  POSITIONS,
  type AccessoryMasses,
  type Accessories,
  type LeadMap,
  type Measured,
  type Position,
  type BaseMode,
  type ExtraLead,
  type GripConfig,
  type RacketSpec,
  type Specs,
} from './types'

/** Swingweight is measured about an axis 10 cm from the butt. */
export const SW_AXIS_CM = 10
/** One balance point = 1/8 inch. */
export const PT_CM = 0.3175
export const STANDARD_LENGTH_CM = 68.58

export interface Geometry {
  L: number
  /** Head semi-length (along the racket) and semi-width, cm. */
  a: number
  b: number
  /** Head centre, cm from the butt. */
  xc: number
}

/** Head modelled as an ellipse with a 1.3 length/width ratio. */
export function geometry(lengthCm: number, headSizeSqIn: number): Geometry {
  const area = headSizeSqIn * 6.4516
  const b = Math.sqrt(area / (Math.PI * 1.3))
  const a = 1.3 * b
  return { L: lengthCm, a, b, xc: lengthCm - a - 1.0 }
}

export interface Point {
  x: number
  y: number
}

/** Where lead sits for each position. y is the distance from the centre line;
 *  10/2h and 3/9h are split equally on both sides, so one |y| covers both. */
export function leadPositions(g: Geometry): Record<Position, Point> {
  return {
    tip: { x: g.L - 1.0, y: 0 },
    tenTwo: { x: g.xc + g.a * Math.cos(Math.PI / 3), y: g.b * Math.sin(Math.PI / 3) },
    threeNine: { x: g.xc, y: g.b },
    throat: { x: g.xc - g.a, y: 0 },
    handle: { x: 6, y: 0 },
  }
}

/** A mass added to the frame. Own inertia terms cover spread-out items. */
export interface MassElement {
  grams: number
  x: number
  y: number
  /** Own moment about the swing axis through its centre, g·cm². */
  ownSwing?: number
  /** Own moment about the long axis through its centre, g·cm². */
  ownTwist?: number
}

export function accessoryElements(g: Geometry, on: Accessories, masses: AccessoryMasses): MassElement[] {
  const out: MassElement[] = []
  if (on.strings) {
    // Stringbed: a uniform elliptical plate just inside the frame.
    const as = g.a - 1.5
    const bs = g.b - 1.5
    const m = masses.strings
    out.push({ grams: m, x: g.xc, y: 0, ownSwing: (m * as * as) / 4, ownTwist: (m * bs * bs) / 4 })
  }
  if (on.leatherGrip) {
    // Extra mass of leather over a synthetic grip, spread along 0-20 cm.
    const m = masses.leatherGrip
    out.push({ grams: m, x: 10, y: 0, ownSwing: (m * 20 * 20) / 12, ownTwist: m * 1.4 * 1.4 })
  }
  if (on.overgrip) {
    const m = masses.overgrip
    out.push({ grams: m, x: 12, y: 0, ownSwing: (m * 24 * 24) / 12, ownTwist: m * 1.5 * 1.5 })
  }
  if (on.dampener) {
    out.push({ grams: masses.dampener, x: g.xc - g.a + 3, y: 0 })
  }
  return out
}

/** Extra overgrips wrap the handle like the first one; sleeves sit under the
 *  grip along the same 0-20 cm as a leather grip. */
export function gripElements(grip: GripConfig | undefined, masses: AccessoryMasses): MassElement[] {
  const out: MassElement[] = []
  for (let i = 0; i < (grip?.extraOvergrips ?? 0); i++) {
    const m = masses.overgrip
    out.push({ grams: m, x: 12, y: 0, ownSwing: (m * 24 * 24) / 12, ownTwist: m * 1.5 * 1.5 })
  }
  for (let i = 0; i < (grip?.sleeves ?? 0); i++) {
    const m = masses.sleeve ?? 7
    out.push({ grams: m, x: 10, y: 0, ownSwing: (m * 20 * 20) / 12, ownTwist: m * 1.4 * 1.4 })
  }
  return out
}

export function leadElements(g: Geometry, lead: LeadMap): MassElement[] {
  const pos = leadPositions(g)
  return POSITIONS.filter((p) => lead[p] > 0).map((p) => ({ grams: lead[p], x: pos[p].x, y: pos[p].y }))
}

/** A point on the hoop at a clock hour (12 at the tip, clockwise). */
export function hoopPoint(g: Geometry, hour: number): Point {
  const th = (hour / 12) * 2 * Math.PI
  return { x: g.xc + g.a * Math.cos(th), y: Math.abs(g.b * Math.sin(th)) }
}

export function extraPoint(g: Geometry, e: ExtraLead): Point {
  return e.kind === 'hoop' ? hoopPoint(g, e.hour ?? 3) : { x: e.cm ?? 6, y: 0 }
}

/** Twistweight is taken about the shaft's centre line, as machines measure it,
 *  so a one-sided strip counts with its distance from that line. */
export function extraElements(g: Geometry, extra: ExtraLead[] | undefined): MassElement[] {
  return (extra ?? []).filter((e) => e.grams > 0).map((e) => ({ grams: e.grams, ...extraPoint(g, e) }))
}

/** Rough twistweight estimate when no value is known (strung-equivalent frames
 *  sit around 13-15 kg·cm²; unstrung a little lower). */
export function estimateTwistweight(headSizeSqIn: number): number {
  return 0.135 * headSizeSqIn
}

export interface Base {
  lengthCm: number
  headSizeSqIn: number
  weightG: number
  balanceCm: number
  swingweight: number
  twistweight?: number
  twistweightEstimated?: boolean
}

/** The starting point: the frame's reference specs, or the user's own
 *  measurements where given. */
export function baseFrom(spec: RacketSpec, mode: BaseMode, measured: Measured): Base {
  const m = mode === 'measured' ? measured : {}
  const tw = m.twistweight ?? spec.twistweight
  return {
    lengthCm: spec.lengthCm,
    headSizeSqIn: spec.headSizeSqIn,
    weightG: m.weightG ?? spec.weightG,
    balanceCm: m.balanceCm ?? spec.balanceCm,
    swingweight: m.swingweight ?? spec.swingweight,
    twistweight: tw ?? estimateTwistweight(spec.headSizeSqIn),
    twistweightEstimated: tw === undefined,
  }
}

export function ptsHeadLight(lengthCm: number, balanceCm: number): number {
  return (lengthCm / 2 - balanceCm) / PT_CM
}

/**
 * Centre of percussion for a swing about the 10 cm axis, in cm from the butt:
 * the impact point that sends no shock to the hand. q = I_axis / (M · d), with
 * d the distance from the axis to the balance point. Lead high in the head
 * moves it towards the tip; lead near the axis barely moves it.
 */
export function centreOfPercussion(swingweight: number, weightG: number, balanceCm: number): number {
  const d = balanceCm - SW_AXIS_CM
  return SW_AXIS_CM + swingweight / ((weightG / 1000) * d)
}

export function recoilWeight(swingweight: number, weightG: number, balanceCm: number): number {
  const d = balanceCm - SW_AXIS_CM
  return swingweight - (weightG / 1000) * d * d
}

/** Specs after adding masses to a base. */
export function applyMasses(base: Base, elements: MassElement[]): Specs {
  let grams = base.weightG
  let moment = base.weightG * base.balanceCm
  let swing = base.swingweight * 1000 // g·cm²
  let twist = (base.twistweight ?? 0) * 1000
  for (const e of elements) {
    grams += e.grams
    moment += e.grams * e.x
    const d = e.x - SW_AXIS_CM
    swing += e.grams * d * d + (e.ownSwing ?? 0)
    twist += e.grams * e.y * e.y + (e.ownTwist ?? 0)
  }
  const balanceCm = moment / grams
  const swingweight = swing / 1000
  return {
    weightG: grams,
    balanceCm,
    ptsHL: ptsHeadLight(base.lengthCm, balanceCm),
    swingweight,
    twistweight: base.twistweight === undefined ? undefined : twist / 1000,
    twistweightEstimated: base.twistweightEstimated,
    recoilWeight: recoilWeight(swingweight, grams, balanceCm),
    sweetSpotCm: centreOfPercussion(swingweight, grams, balanceCm),
  }
}

export interface ComputeInput {
  spec: RacketSpec
  baseMode: BaseMode
  measured: Measured
  accessories: Accessories
  leadG: LeadMap
  extra?: ExtraLead[]
  grip?: GripConfig
  masses: AccessoryMasses
}

export function compute(input: ComputeInput): { base: Specs; result: Specs } {
  const base = baseFrom(input.spec, input.baseMode, input.measured)
  const g = geometry(base.lengthCm, base.headSizeSqIn)
  const elements = [
    ...accessoryElements(g, input.accessories, input.masses),
    ...leadElements(g, input.leadG),
    ...extraElements(g, input.extra),
    ...gripElements(input.grip, input.masses),
  ]
  return { base: applyMasses(base, []), result: applyMasses(base, elements) }
}
