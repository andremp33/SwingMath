/**
 * Words a published setup's name or signature may not carry: insults and
 * slurs in Portuguese, English and Spanish. Whole words only, after folding
 * accents, case and the usual letter-for-digit swaps, so ordinary names
 * ("Classe", "Pure Aero") are never caught; words with an everyday meaning
 * too (a queue, a goat, a deer) stay out. A first filter, before reports.
 */
const BLOCKED = new Set(
  [
    // Portuguese
    'caralho', 'foda', 'fodase', 'foder', 'fodido', 'merda', 'puta', 'puto', 'putas', 'cabrao', 'paneleiro', 'panasca', 'conas', 'cona', 'piroca', 'viado', 'otario', 'babaca', 'arrombado', 'buceta', 'porra', 'cuzao', 'escroto', 'filhodaputa', 'fdp', 'pqp',
    // English
    'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'pussy', 'whore', 'slut', 'faggot', 'nigger', 'nigga', 'retard', 'twat', 'wanker',
    // Spanish
    'mierda', 'joder', 'jodido', 'cabron', 'cabrona', 'gilipollas', 'pendejo', 'pendeja', 'maricon', 'marica', 'zorra', 'coño', 'cono', 'hijoputa', 'hdp', 'malparido', 'culero', 'chinga', 'chingada', 'pinche',
  ].map((w) => fold(w)),
)

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' }

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$]/g, (c) => SWAPS[c] ?? c)
}

/** True when the text holds a blocked word, alone or written with letters spaced or doubled. */
export function hasBlockedWords(text: string | null | undefined): boolean {
  if (!text) return false
  const words = fold(text).split(/[^a-z]+/).filter(Boolean)
  const squeeze = (w: string) => w.replace(/(.)\1+/g, '$1')
  if (words.some((w) => BLOCKED.has(w) || BLOCKED.has(squeeze(w)))) return true
  // "f.u.c.k" or "m e r d a": single letters run together.
  const singles = words.map((w) => (w.length === 1 ? w : ' ')).join('').split(' ').filter((w) => w.length > 2)
  return singles.some((w) => BLOCKED.has(w))
}
