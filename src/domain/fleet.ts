import type { Measurement, OwnedRacket, Stringing } from './journal'
import { TOLERANCE, type TargetKey } from './match'

/**
 * The player's fleet: their rackets as last measured, side by side. One is
 * the reference (#1), and each of the others shows how far it is from it.
 */

/** Measurements kept per racket, newest first. */
export const MAX_MEASUREMENTS = 30

/** A new measurement (or an edited one, by id) in a racket's list: newest
 *  first, the oldest dropped past MAX_MEASUREMENTS. */
export function addMeasurement(list: Measurement[] | undefined, m: Measurement): Measurement[] {
  return [m, ...(list ?? []).filter((x) => x.id !== m.id)].sort((a, b) => b.date - a.date).slice(0, MAX_MEASUREMENTS)
}

export const latestMeasurement = (o: OwnedRacket): Measurement | undefined => o.measurements?.[0]

/** Within the solver's tolerance: green. Up to twice it: yellow. More: red. */
export type Light = 'green' | 'yellow' | 'red'
const LIGHTS: Light[] = ['green', 'yellow', 'red']

export function lightFor(diff: number, tolerance: number): Light {
  const d = Math.abs(diff)
  // A hair of rounding (a balance of 32.1 - 32.0 cm) is not a step up.
  return d <= tolerance + 1e-9 ? 'green' : d <= 2 * tolerance + 1e-9 ? 'yellow' : 'red'
}

export type Deviation = Partial<Record<TargetKey, number>>

/** How far one measurement is from the reference's: this minus that. */
export function deviation(m: Measurement, ref: Measurement): Deviation {
  const d: Deviation = { weightG: m.weightG - ref.weightG, balanceCm: m.balanceCm - ref.balanceCm, swingweight: m.swingweight - ref.swingweight }
  if (m.twistweight !== undefined && ref.twistweight !== undefined) d.twistweight = m.twistweight - ref.twistweight
  return d
}

export interface FleetRow {
  owned: OwnedRacket
  measurement: Measurement
  /** Against the reference; none for the reference itself, or when one was
   *  measured with strings and the other without. */
  deviation?: Deviation
  lights?: Partial<Record<TargetKey, Light>>
  /** The worst of the lights. */
  worst?: Light
  /** Measured in the same state (strung or not) as the reference. */
  comparable: boolean
}

export interface Fleet {
  reference?: FleetRow
  /** The other measured rackets in play, in the order they were added. */
  others: FleetRow[]
}

/** The reference: the player's choice while it is measured and in play,
 *  else the one with the highest swingweight (lead only adds). */
export function fleetReferenceId(owned: OwnedRacket[], chosen?: string): string | undefined {
  const measured = owned.filter((o) => !o.retired && latestMeasurement(o))
  if (chosen && measured.some((o) => o.id === chosen)) return chosen
  return [...measured].sort((a, b) => latestMeasurement(b)!.swingweight - latestMeasurement(a)!.swingweight)[0]?.id
}

/** Every measured racket in play against the reference, by its latest
 *  measurement. */
export function fleetReport(owned: OwnedRacket[], chosen?: string): Fleet {
  const refId = fleetReferenceId(owned, chosen)
  const rows = owned.filter((o) => !o.retired && latestMeasurement(o)).sort((a, b) => a.createdAt - b.createdAt)
  const ref = rows.find((o) => o.id === refId)
  if (!ref) return { others: [] }
  const refM = latestMeasurement(ref)!
  const others = rows
    .filter((o) => o.id !== ref.id)
    .map((o): FleetRow => {
      const m = latestMeasurement(o)!
      if (m.strung !== refM.strung) return { owned: o, measurement: m, comparable: false }
      const d = deviation(m, refM)
      const lights: FleetRow['lights'] = {}
      for (const k of Object.keys(d) as TargetKey[]) lights[k] = lightFor(d[k]!, TOLERANCE[k])
      const worst = LIGHTS[Math.max(...Object.values(lights).map((l) => LIGHTS.indexOf(l)))]
      return { owned: o, measurement: m, deviation: d, lights, worst, comparable: true }
    })
  return { reference: { owned: ref, measurement: refM, comparable: true }, others }
}

/** Restrung since it was last measured: its numbers have moved. */
export const needsRemeasure = (o: OwnedRacket, latest?: Stringing) => {
  const m = latestMeasurement(o)
  return !!m && !!latest && latest.date > m.date
}
