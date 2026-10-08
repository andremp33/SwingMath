import { useStore } from '../data/store'
import { en } from './en'
import { es } from './es'
import { pt } from './pt'

export type Lang = 'pt' | 'en' | 'es'
export type Dict = typeof pt

const DICTS: Record<Lang, Dict> = { pt, en, es }

export function useT(): Dict {
  const lang = useStore((s) => s.lang)
  return DICTS[lang]
}

/** Replaces {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
