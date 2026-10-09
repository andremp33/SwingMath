import { geometry } from './physics'

/**
 * Strings: stringbed stiffness, equivalent tension between frames, tension
 * loss and string life.
 *
 * Everything here is a model with rules of thumb, not lab data for a given
 * string. It is good for comparing ("18x20 at 23 kg feels like 16x19 at
 * 25 kg") and for a reminder to restring, and the UI says so.
 */

export const MATERIALS = ['poly', 'copoly', 'synthetic', 'multi', 'gut'] as const
export type StringMaterial = (typeof MATERIALS)[number]

export interface StringSpec {
  material: StringMaterial
  tensionKg: number
  /** Brand and model, free text. */
  name?: string
  gaugeMm?: number
}

/** Mains, and crosses when it is a hybrid (otherwise the same as mains). */
export interface Stringbed {
  mains: StringSpec
  crosses?: StringSpec
}

interface MaterialProps {
  /** Typical dynamic stiffness of the string, lb/in. */
  stiffness: number
  /** Share of tension lost in the first day, before any play. */
  initialLoss: number
  /** Further share lost per hour of play and per week on the racket. */
  perHour: number
  perWeek: number
  /** Hours of play before it plays "dead", and weeks before it does unplayed. */
  lifeHours: number
  lifeWeeks: number
  /** How easily the strings slide and snap back (spin), 0-1. */
  snapback: number
  /** Arm friendliness, 0-1. */
  comfort: number
}

// Typical ranges published by string makers and testers, rounded. Polyester
// loses tension fastest and goes dead long before it breaks; gut holds best.
export const MATERIAL: Record<StringMaterial, MaterialProps> = {
  poly: { stiffness: 235, initialLoss: 0.13, perHour: 0.004, perWeek: 0.012, lifeHours: 18, lifeWeeks: 8, snapback: 1, comfort: 0.1 },
  copoly: { stiffness: 205, initialLoss: 0.11, perHour: 0.0035, perWeek: 0.01, lifeHours: 22, lifeWeeks: 10, snapback: 0.85, comfort: 0.3 },
  synthetic: { stiffness: 195, initialLoss: 0.1, perHour: 0.0025, perWeek: 0.008, lifeHours: 30, lifeWeeks: 14, snapback: 0.4, comfort: 0.55 },
  multi: { stiffness: 170, initialLoss: 0.09, perHour: 0.0022, perWeek: 0.007, lifeHours: 30, lifeWeeks: 14, snapback: 0.45, comfort: 0.85 },
  gut: { stiffness: 125, initialLoss: 0.06, perHour: 0.0015, perWeek: 0.005, lifeHours: 40, lifeWeeks: 20, snapback: 0.7, comfort: 1 },
}

export const DEFAULT_STRINGBED: Stringbed = { mains: { material: 'poly', tensionKg: 23 } }

/** "16x19" -> [16, 19]. Falls back to 16x19. */
export function parsePattern(p?: string): [mains: number, crosses: number] {
  const m = /^(\d{2})\s*[x×]\s*(\d{2})$/.exec(p?.trim() ?? '')
  return m ? [Number(m[1]), Number(m[2])] : [16, 19]
}

export interface FrameForStrings {
  headSizeSqIn: number
  pattern?: string
  lengthCm?: number
}

const crossesOf = (s: Stringbed) => s.crosses ?? s.mains

/**
 * Stiffness of the stringbed at its centre, in arbitrary units.
 *
 * The bed is treated as a membrane under tension: mains give a tension per
 * unit width of T·mains/width, crosses T·crosses/length, and a ball pushing
 * on the centre of a membrane meets a stiffness of about 2π·N / ln(R/r0)
 * (R the bed's radius, r0 the contact patch). The string's own stiffness
 * adds how much tension rises as it stretches during impact.
 */
function rawStiffness(frame: FrameForStrings, bed: Stringbed, retained = { mains: 1, crosses: 1 }) {
  const g = geometry(frame.lengthCm ?? 68.58, frame.headSizeSqIn)
  const [nm, nc] = parsePattern(frame.pattern)
  const dyn = (s: StringSpec) => 0.8 + (0.2 * MATERIAL[s.material].stiffness) / 200
  const c = crossesOf(bed)
  const Nm = (bed.mains.tensionKg * retained.mains * dyn(bed.mains) * nm) / (2 * (g.b - 1.5))
  const Nc = (c.tensionKg * retained.crosses * dyn(c) * nc) / (2 * (g.a - 1.5))
  const R = Math.sqrt((g.a - 1.5) * (g.b - 1.5))
  return (2 * Math.PI * Math.sqrt(Nm * Nc)) / Math.log(R / 2)
}

const REFERENCE = rawStiffness({ headSizeSqIn: 100, pattern: '16x19' }, { mains: { material: 'synthetic', tensionKg: 23 } })

/** Stringbed stiffness index: 100 = a 100 sq in 16x19 frame, synthetic gut at 23 kg, freshly strung. */
export function stringbedIndex(frame: FrameForStrings, bed: Stringbed, retained?: { mains: number; crosses: number }) {
  return (100 * rawStiffness(frame, bed, retained)) / REFERENCE
}

/**
 * The tension that gives `to` the same stringbed stiffness `from` has.
 * Hybrids keep their mains/crosses difference.
 */
export function equivalentTension(from: { frame: FrameForStrings; bed: Stringbed }, to: { frame: FrameForStrings; bed: Stringbed }) {
  const target = stringbedIndex(from.frame, from.bed)
  const now = stringbedIndex(to.frame, to.bed)
  // Stiffness is proportional to tension, so one scale factor does it.
  const k = target / now
  const round = (kg: number) => Math.round(kg * 2) / 2
  return {
    mainsKg: round(to.bed.mains.tensionKg * k),
    crossesKg: round(crossesOf(to.bed).tensionKg * k),
  }
}

/** Share of the starting tension left after some play and some days. */
export function tensionRetained(material: StringMaterial, hours: number, days: number) {
  const m = MATERIAL[material]
  const settle = m.initialLoss * (1 - Math.exp(-days / 0.5))
  return Math.max(0.6, 1 - settle - m.perHour * hours - (m.perWeek * days) / 7)
}

export interface StringLife {
  /** 0 = just strung, 1 = time to restring. Can go above 1. */
  used: number
  hoursLeft: number
  /** Estimated tension now, mains and crosses, kg. */
  mainsKg: number
  crossesKg: number
  /** What ends its life first. */
  limit: 'hours' | 'time'
}

/**
 * How much of the string's life is used. Life ends at the material's playing
 * hours, or its weeks on the racket, whichever comes first; the player can
 * set their own hours (they know their strings best).
 */
export function stringLife(bed: Stringbed, hours: number, days: number, lifeHours?: number): StringLife {
  // A hybrid dies when its least durable string does.
  const mats = [bed.mains.material, crossesOf(bed).material].map((k) => MATERIAL[k])
  const life = lifeHours ?? Math.min(...mats.map((m) => m.lifeHours))
  const weeks = Math.min(...mats.map((m) => m.lifeWeeks))
  const byHours = hours / life
  const byTime = days / 7 / weeks
  const c = crossesOf(bed)
  const used = Math.max(byHours, byTime)
  return {
    used,
    hoursLeft: Math.max(0, life * (1 - used)),
    mainsKg: bed.mains.tensionKg * tensionRetained(bed.mains.material, hours, days),
    crossesKg: c.tensionKg * tensionRetained(c.material, hours, days),
    limit: byHours >= byTime ? 'hours' : 'time',
  }
}

export const STRING_FEEL_KEYS = ['power', 'control', 'comfort', 'spin'] as const
export type StringFeelKey = (typeof STRING_FEEL_KEYS)[number]
export type StringFeel = Record<StringFeelKey, number>

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

/**
 * How the stringbed plays, 5-95 %. A softer bed returns more energy and is
 * kinder to the arm; a stiffer one launches lower (control); open patterns
 * and slick polyester snap back for spin.
 */
export function stringFeel(frame: FrameForStrings, bed: Stringbed): StringFeel {
  const idx = norm(stringbedIndex(frame, bed), 80, 125)
  const [nm, nc] = parsePattern(frame.pattern)
  const open = norm(frame.headSizeSqIn / (nm * nc), 0.24, 0.4)
  const mains = MATERIAL[bed.mains.material]
  const soft = (MATERIAL[bed.mains.material].comfort + MATERIAL[crossesOf(bed).material].comfort) / 2
  const raw: StringFeel = {
    power: 0.75 * (1 - idx) + 0.25 * open,
    control: 0.7 * idx + 0.3 * (1 - open),
    comfort: 0.55 * soft + 0.45 * (1 - idx),
    spin: 0.5 * mains.snapback + 0.35 * open + 0.15 * (1 - idx),
  }
  const out = {} as StringFeel
  for (const k of STRING_FEEL_KEYS) out[k] = Math.round(5 + 90 * raw[k])
  return out
}
