import { shortName } from '../data/stringCatalog'
import type { Stringbed, StringSpec } from '../domain/strings'
import type { Dict } from '../i18n'
import { fmtNum } from './format'

/**
 * The strings in a few words: "RPM Blast 1,25 · 23 kg" when they have a
 * name, "Poli 23 kg" when not, and both sides of a hybrid
 * ("RPM Blast 1,25 · 24 / Multi 22 kg").
 */
export function bedLabel(bed: Stringbed, t: Dict, lang: string) {
  const kg = (s: StringSpec) => fmtNum(s.tensionKg, s.tensionKg % 1 ? 1 : 0, lang)
  const one = (s: StringSpec) =>
    s.name?.trim() ? `${shortName(s.name)}${s.gaugeMm ? ` ${fmtNum(s.gaugeMm, 2, lang)}` : ''} · ${kg(s)}` : `${t.strings.short[s.material]} ${kg(s)}`
  return bed.crosses ? `${one(bed.mains)} / ${one(bed.crosses)} kg` : `${one(bed.mains)} kg`
}
