import type { Dict } from '../i18n'
import { POSITIONS, type ExtraLead, type LeadMap } from '../domain/types'
export const LOCALE: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', es: 'es-ES' }
export const decimalComma = (lang: string) => lang !== 'en'

/** Accepts "12,5" and "12.5". Returns undefined for blank or invalid. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return undefined
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function fmtNum(n: number | undefined, digits = 1, lang = 'pt'): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString(LOCALE[lang] ?? 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtSigned(n: number, digits = 1, lang = 'pt'): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  if (r === 0) return fmtNum(0, digits, lang)
  return (r > 0 ? '+' : '−') + fmtNum(Math.abs(r), digits, lang)
}

export function fmtDate(ts: number, lang = 'pt'): string {
  return new Date(ts).toLocaleDateString(LOCALE[lang] ?? 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Centimetres of tape for a mass, given the player's tape (g per 10 cm). */
export const tapeCm = (grams: number, gPer10cm: number) => (grams / gPer10cm) * 10

export const racketLabel = (r: { brand: string; model: string; year?: number }) =>
  `${r.brand} ${r.model}${r.year ? ` (${r.year})` : ''}`

/** "11h e 1h", "4h, um lado", "Haste a 25 cm". */
export function extraLabel(e: ExtraLead, t: Dict, lang: string): string {
  if (e.kind === 'shaft') return fmt(t.custom.shaftAt, { cm: fmtNum(e.cm ?? 0, e.cm && e.cm % 1 ? 1 : 0, lang) })
  const h = e.hour ?? 3
  const mirror = 12 - h
  if (e.sides === 2 && h !== 6) {
    // Players say "10 and 2", "11 and 1" at the top of the head, "4 and 8" lower down.
    const lo = Math.min(h, mirror)
    const hi = Math.max(h, mirror)
    const [first, second] = lo < 3 ? [hi, lo] : [lo, hi]
    return fmt(t.custom.hoopBoth, { a: t.custom.hour(first), b: t.custom.hour(second) })
  }
  return fmt(t.custom.hoopOne, { a: t.custom.hour(h) })
}

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

/** Every place with lead, for one-line summaries: "12h 2,0 g · 11h e 1h 1,5 g". */
export function leadParts(cfg: { leadG: LeadMap; extra?: ExtraLead[] }, t: Dict, lang: string): string[] {
  return [
    ...POSITIONS.filter((p) => cfg.leadG[p] > 0).map((p) => `${t.posShort[p]} ${fmtNum(cfg.leadG[p], 1, lang)} g`),
    ...(cfg.extra ?? []).filter((e) => e.grams > 0).map((e) => `${extraLabel(e, t, lang)} ${fmtNum(e.grams, 1, lang)} g`),
  ]
}
