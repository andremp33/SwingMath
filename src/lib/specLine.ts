import type { Measurement } from '../domain/journal'
import type { Dict } from '../i18n'
import { fmt } from '../i18n'
import { fmtNum } from './format'
import type { Units } from './units'

/** A measurement in one line: "318 g · 324 mm · SW 322" (or ounces and
 *  inches), with TW when it has one. */
export function specLine(m: Measurement, t: Dict, lang: string, u: Units) {
  const v = { w: `${u.weight(m.weightG)} ${u.weightUnit}`, b: `${u.balance(m.balanceCm)} ${u.balanceUnit}`, sw: fmtNum(m.swingweight, 0, lang) }
  return m.twistweight === undefined ? fmt(t.fleet.latest, v) : fmt(t.fleet.latestTw, { ...v, tw: fmtNum(m.twistweight, 1, lang) })
}
