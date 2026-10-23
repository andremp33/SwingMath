import { useStore } from '../data/store'
import type { pt } from './pt'

export type Lang = 'pt' | 'en' | 'es'
export type Dict = typeof pt

// Each language in its own chunk: the app loads the one it shows.
const LOAD: Record<Lang, () => Promise<Dict>> = {
  pt: () => import('./pt').then((m) => m.pt),
  en: () => import('./en').then((m) => m.en),
  es: () => import('./es').then((m) => m.es),
}
const DICTS: Partial<Record<Lang, Dict>> = {}

/** Loads a language before it is shown: at start, and before a switch. */
export async function loadLang(lang: Lang) {
  DICTS[lang] ??= await LOAD[lang]()
}

export function useT(): Dict {
  const lang = useStore((s) => s.lang)
  return DICTS[lang]!
}

/** Replaces {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
