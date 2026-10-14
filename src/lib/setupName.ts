import { shortName } from '../data/stringCatalog'
import { POSITIONS, type Racket, type SetupConfig } from '../domain/types'
import type { Dict } from '../i18n'
import { extraLabel, fmtNum } from './format'

/**
 * A name to start from when saving: the frame and what changed most,
 * "VCORE 98 · +2 g 3/9h". The lead first (the biggest piece, and the next
 * if there is one), else the strings when they have a name, else the frame.
 */
export function suggestSetupName(cfg: SetupConfig, racket: Racket | undefined, t: Dict, lang: string): string {
  const model = racket?.model.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const g = (n: number) => fmtNum(n, n % 1 ? 1 : 0, lang)
  const lead = [
    ...POSITIONS.filter((p) => cfg.leadG[p] > 0).map((p) => ({ grams: cfg.leadG[p], text: `+${g(cfg.leadG[p])} g ${t.posShort[p]}` })),
    ...(cfg.extra ?? []).filter((e) => e.grams > 0).map((e) => ({ grams: e.grams, text: `+${g(e.grams)} g ${extraLabel(e, t, lang)}` })),
  ].sort((a, b) => b.grams - a.grams)
  const mains = cfg.strings?.mains
  const change = lead.length
    ? lead
        .slice(0, 2)
        .map((x) => x.text)
        .join(', ')
    : mains?.name?.trim()
      ? `${shortName(mains.name)} ${g(mains.tensionKg)} kg`
      : undefined
  return [model, change].filter(Boolean).join(' · ').slice(0, 60)
}
