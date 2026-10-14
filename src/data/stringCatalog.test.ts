import { describe, expect, it } from 'vitest'
import { MATERIALS } from '../domain/strings'
import { en } from '../i18n/en'
import { pt } from '../i18n/pt'
import { bedLabel } from '../lib/bedLabel'
import { catalogName, findString, gaugeLabel, pickString, STRING_CATALOG, suggestStrings } from './stringCatalog'

describe('string catalogue', () => {
  it('is valid: unique ids and names, known materials, gauges, a maker’s page', () => {
    expect(STRING_CATALOG.length).toBeGreaterThanOrEqual(55)
    expect(new Set(STRING_CATALOG.map((s) => s.id)).size).toBe(STRING_CATALOG.length)
    expect(new Set(STRING_CATALOG.map((s) => catalogName(s).toLowerCase())).size).toBe(STRING_CATALOG.length)
    for (const s of STRING_CATALOG) {
      expect(MATERIALS, s.id).toContain(s.material)
      expect(s.gaugesMm.length, s.id).toBeGreaterThan(0)
      for (const g of s.gaugesMm) expect(g >= 1 && g <= 1.6, `${s.id} ${g}`).toBe(true)
      expect([...s.gaugesMm].sort((a, b) => a - b), s.id).toEqual(s.gaugesMm)
      if (s.usGauges) expect(s.usGauges.length, s.id).toBe(s.gaugesMm.length)
      expect(s.source, s.id).toMatch(/^https:\/\/[\w.-]+\.\w+\//)
    }
  })

  it('has the strings players ask for', () => {
    for (const name of ['Babolat RPM Blast', 'Luxilon ALU Power', 'Solinco Hyper-G', 'Yonex Poly Tour Pro', 'Tecnifibre X-One Biphase', 'Wilson NXT', 'Diadem Solstice Power'])
      expect(findString(name), name).toBeDefined()
  })

  it('finds by brand, model or both, whatever the case or accents', () => {
    expect(suggestStrings('rpm').map((o) => o.name)).toContain('Babolat RPM Blast')
    expect(suggestStrings('lux 4g').map((o) => o.name)).toEqual(['Luxilon 4G', 'Luxilon 4G Soft', 'Luxilon 4G Rough'])
    expect(suggestStrings('HYPER g soft')[0].name).toBe('Solinco Hyper-G Soft')
    expect(suggestStrings('zzz')).toEqual([])
  })

  it('puts the player’s last strings first, catalogue or not', () => {
    const r = suggestStrings('', ['babolat rpm blast', 'My club poly'])
    expect(r.map((o) => [o.name, o.recent])).toEqual([
      ['Babolat RPM Blast', true],
      ['My club poly', true],
    ])
    expect(suggestStrings('blast', ['Babolat RPM Blast'])[0]).toMatchObject({ name: 'Babolat RPM Blast', recent: true })
  })

  it('choosing a string fills in its name and material, and keeps a gauge it comes in', () => {
    const rough = findString('Babolat RPM Rough')!
    expect(pickString({ material: 'multi', tensionKg: 24 }, rough)).toEqual({ material: 'poly', tensionKg: 24, name: 'Babolat RPM Rough', gaugeMm: undefined })
    expect(pickString({ material: 'multi', tensionKg: 24, gaugeMm: 1.3 }, rough).gaugeMm).toBe(1.3)
    // RPM Rough has no 1.20.
    expect(pickString({ material: 'multi', tensionKg: 24, gaugeMm: 1.2 }, rough).gaugeMm).toBeUndefined()
    expect(pickString({ material: 'poly', tensionKg: 24 }, findString('Babolat Touch VS')!).material).toBe('gut')
  })

  it('keeps the maker’s own gauge numbers', () => {
    const nxt = findString('Wilson NXT')!
    expect(gaugeLabel(nxt, 1.3)).toBe('16')
    expect(gaugeLabel(findString('Babolat RPM Blast'), 1.25)).toBeUndefined()
  })
})

describe('bedLabel', () => {
  it('names the strings when they have a name', () => {
    expect(bedLabel({ mains: { material: 'poly', tensionKg: 23, name: 'Babolat RPM Blast', gaugeMm: 1.25 } }, en, 'en')).toBe('RPM Blast 1.25 · 23 kg')
    expect(bedLabel({ mains: { material: 'poly', tensionKg: 23, name: 'Babolat RPM Blast', gaugeMm: 1.25 } }, pt, 'pt')).toBe('RPM Blast 1,25 · 23 kg')
    expect(bedLabel({ mains: { material: 'poly', tensionKg: 22.5, name: 'Club poly' } }, pt, 'pt')).toBe('Club poly · 22,5 kg')
  })

  it('stays as it was without a name', () => {
    expect(bedLabel({ mains: { material: 'poly', tensionKg: 23 } }, pt, 'pt')).toBe('Poli 23 kg')
    expect(bedLabel({ mains: { material: 'poly', tensionKg: 24 }, crosses: { material: 'multi', tensionKg: 22 } }, pt, 'pt')).toBe('Poli 24 / Multi 22 kg')
  })

  it('shows both sides of a hybrid', () => {
    const bed = { mains: { material: 'poly' as const, tensionKg: 24, name: 'Babolat RPM Blast', gaugeMm: 1.25 }, crosses: { material: 'gut' as const, tensionKg: 22, name: 'Babolat Touch VS', gaugeMm: 1.3 } }
    expect(bedLabel(bed, pt, 'pt')).toBe('RPM Blast 1,25 · 24 / Touch VS 1,30 · 22 kg')
  })
})
