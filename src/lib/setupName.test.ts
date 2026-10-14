import { describe, expect, it } from 'vitest'
import { STOCK_RACKETS } from '../data/rackets'
import { defaultConfig } from '../data/store'
import { pt } from '../i18n/pt'
import { suggestSetupName } from './setupName'

const vcore = STOCK_RACKETS.find((r) => r.model.startsWith('VCORE 98 ('))!

describe('suggested setup name', () => {
  it('the frame and the biggest piece of lead', () => {
    const cfg = { ...defaultConfig(vcore.id), leadG: { tip: 0, tenTwo: 0, threeNine: 2, throat: 0, handle: 0 } }
    expect(suggestSetupName(cfg, vcore, pt, 'pt')).toBe('VCORE 98 · +2 g 3/9h')
  })

  it('two pieces at most, biggest first', () => {
    const cfg = { ...defaultConfig(vcore.id), leadG: { tip: 1.5, tenTwo: 0, threeNine: 4, throat: 0, handle: 3 } }
    expect(suggestSetupName(cfg, vcore, pt, 'pt')).toBe('VCORE 98 · +4 g 3/9h, +3 g Cabo')
  })

  it('without lead, the strings by name; else the frame alone', () => {
    const cfg = { ...defaultConfig(vcore.id), strings: { mains: { material: 'poly' as const, tensionKg: 23, name: 'Babolat RPM Blast' } } }
    expect(suggestSetupName(cfg, vcore, pt, 'pt')).toBe('VCORE 98 · RPM Blast 23 kg')
    expect(suggestSetupName(defaultConfig(vcore.id), vcore, pt, 'pt')).toBe('VCORE 98')
  })
})
