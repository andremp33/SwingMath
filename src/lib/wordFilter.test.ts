import { describe, expect, it } from 'vitest'
import { hasBlockedWords } from './wordFilter'

describe('word filter', () => {
  it('catches insults in the three languages, whatever the case and accents', () => {
    expect(hasBlockedWords('Setup de merda')).toBe(true)
    expect(hasBlockedWords('PUTA que pariu')).toBe(true)
    expect(hasBlockedWords('Gilipollas')).toBe(true)
    expect(hasBlockedWords('maricón')).toBe(true)
  })

  it('sees through digits, doubled letters and spaced letters', () => {
    expect(hasBlockedWords('sh1t')).toBe(true)
    expect(hasBlockedWords('Fuuuck')).toBe(true)
    expect(hasBlockedWords('m e r d a')).toBe(true)
  })

  it('leaves ordinary names alone', () => {
    // Everyday words too: a queue, a goat, a deer.
    for (const ok of ['Pure Aero #1', 'Classe', 'Mais plow', 'Estável para torneio', 'Cocktail', 'Scunthorpe', 'Polivalente', 'Ana Silva', 'Setup da bicha', 'Cabra', 'Veado', ''])
      expect(hasBlockedWords(ok)).toBe(false)
    expect(hasBlockedWords(null)).toBe(false)
  })
})
