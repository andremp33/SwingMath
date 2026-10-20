import type { Measurement } from '../domain/journal'
import type { Dict } from '../i18n'
import { fmt } from '../i18n'
import { fmtNum } from './format'

/** A measurement in one line: "318 g · 324 mm · SW 322", with TW when it
 *  has one. */
export function specLine(m: Measurement, t: Dict, lang: string) {
  const v = { w: fmtNum(m.weightG, 0, lang), b: fmtNum(m.balanceCm * 10, 0, lang), sw: fmtNum(m.swingweight, 0, lang) }
  return m.twistweight === undefined ? fmt(t.fleet.latest, v) : fmt(t.fleet.latestTw, { ...v, tw: fmtNum(m.twistweight, 1, lang) })
}
