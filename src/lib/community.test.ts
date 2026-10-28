import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { STOCK_RACKETS } from '../data/rackets'
import { compute } from '../domain/physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead, type Racket } from '../domain/types'
import {
  filterRecipes,
  frameDistance,
  hasLead,
  holdingFirst,
  measuredHolds,
  measurementAfter,
  parsePublicSetups,
  rankPublicSetups,
  republishPlan,
  roundResults,
  siblingsOf,
  SIMILAR_WITHIN,
  similarRecipes,
  specsHold,
  type PublicSetup,
} from './community'

const config = {
  racketId: 'stock-x',
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
  leadG: { ...emptyLead(), tip: 2 },
}
const row = (over: Partial<PublicSetup> = {}): PublicSetup =>
  ({
    id: 'a',
    author_key: 'k',
    racket_id: 'stock-x',
    name: 'Receita',
    author: null,
    config,
    racket: null,
    specs: { weightG: 330, balanceCm: 32.4, swingweight: 330 },
    copies: 0,
    created_at: '2026-10-10T00:00:00Z',
    goals: [],
    level: null,
    style: null,
    results: null,
    setup_ref: null,
    partner: null,
    updated_at: '2026-10-10T00:00:00Z',
    mine: false,
    hidden: false,
    ...over,
  }) as PublicSetup

describe('community recipes', () => {
  it('ranks partners first, then the most saved, then the newest', () => {
    const list = [
      row({ id: 'saved', copies: 9 }),
      row({ id: 'new', created_at: '2026-10-12T00:00:00Z' }),
      row({ id: 'old', created_at: '2026-10-01T00:00:00Z' }),
      row({ id: 'shop', partner: 'Loja do Bairro' }),
    ]
    expect(rankPublicSetups(list).map((p) => p.id)).toEqual(['shop', 'saved', 'new', 'old'])
  })

  it('the author rating their own recipe does not move it up', () => {
    const list = [row({ id: 'saved', copies: 3 }), row({ id: 'self-rated', results: { sessions: 5, hours: 4, avg: { overall: 5 } } })]
    expect(rankPublicSetups(list).map((p) => p.id)).toEqual(['saved', 'self-rated'])
  })

  it('filters by goal', () => {
    const list = [row({ id: 's', goals: ['stability'] }), row({ id: 'p', goals: ['power', 'spin'] }), row({ id: 'none' })]
    expect(rankPublicSetups(list, 'spin').map((p) => p.id)).toEqual(['p'])
    expect(rankPublicSetups(list)).toHaveLength(3)
  })

  it('drops rows written wrong, keeps the good ones', () => {
    const good = row({ goals: ['comfort'], level: 'advanced' })
    const rows = [good, { ...good, id: 'bad-goal', goals: ['speed'] }, { ...good, id: 'bad-config', config: { leadG: 'lots' } }, { ...good, id: 'bad-results', results: { sessions: 3, hours: 2, avg: { overall: 9 } } }]
    expect(parsePublicSetups(rows).map((p) => p.id)).toEqual(['a'])
  })

  it('rows from before recipes still read, with empty recipe fields', () => {
    const { goals: _g, level: _l, style: _s, results: _r, setup_ref: _f, partner: _p, mine: _m, hidden: _h, ...old } = row()
    const [p] = parsePublicSetups([old])
    expect(p).toMatchObject({ goals: [], level: null, results: null, partner: null, mine: false, hidden: false })
  })

  it('rounds averages to a tenth and hours to the half hour', () => {
    expect(roundResults({ sessions: 4, hours: 3.3, avg: { overall: 4.26, comfort: 3.94 } })).toEqual({ sessions: 4, hours: 3.5, avg: { overall: 4.3, comfort: 3.9 } })
  })
})

describe('publishing a setup again', () => {
  const prev = { id: 'row', racket_id: 'stock-x', hidden: false }
  it('first time inserts; same frame updates', () => {
    expect(republishPlan(null, 'stock-x')).toBe('insert')
    expect(republishPlan(prev, 'stock-x')).toBe('update')
  })
  it('another frame replaces the old recipe with a new one', () => {
    expect(republishPlan(prev, 'stock-y')).toBe('replace')
  })
  it('a recipe hidden by reports is never replaced or updated', () => {
    expect(republishPlan({ ...prev, hidden: true }, 'stock-y')).toBe('hidden')
    expect(republishPlan({ ...prev, hidden: true }, 'stock-x')).toBe('hidden')
  })
})

describe('other versions and similar frames', () => {
  const frame = (id: string, brand: string, model: string, w = 305, b = 32, sw = 290) => ({ id, brand, model, isStock: true, weightG: w, balanceCm: b, swingweight: sw }) as Racket

  it('the same brand and model, another year, is another version', () => {
    const aero26 = frame('a26', 'Babolat', 'Pure Aero 98')
    const all = [aero26, frame('a23', 'babolat', 'Pure Aero 98 '), frame('aero', 'Babolat', 'Pure Aero'), frame('blade', 'Wilson', 'Blade 98')]
    expect(siblingsOf(aero26, all)).toEqual(['a23'])
    expect(siblingsOf({ ...aero26, isStock: false }, all)).toEqual([])
  })

  it('this frame’s recipes come before its other versions’, after partners', () => {
    const list = [row({ id: 'old-version', racket_id: 'a23', copies: 50 }), row({ id: 'here', racket_id: 'a26', copies: 1 }), row({ id: 'shop', racket_id: 'a23', partner: 'Loja' })]
    expect(rankPublicSetups(list, undefined, 'a26').map((p) => p.id)).toEqual(['shop', 'here', 'old-version'])
  })

  it('similar frames: close in weight, balance and swingweight, closest first', () => {
    const mine = frame('mine', 'X', 'Mine', 305, 32, 290)
    const frames: Record<string, Racket> = {
      near: frame('near', 'Y', 'Near', 307, 32.1, 292),
      nearer: frame('nearer', 'Y', 'Nearer', 305, 32, 291),
      far: frame('far', 'Z', 'Far', 285, 33.5, 270),
      sibling: frame('sibling', 'X', 'Mine', 305, 32, 290),
    }
    const list = ['near', 'nearer', 'far', 'sibling', 'mine'].map((id) => row({ id, racket_id: id }))
    const got = similarRecipes(list, mine, ['sibling'], (p) => frames[p.racket_id])
    expect(got.map((p) => p.id)).toEqual(['nearer', 'near'])
    expect(frameDistance(frames.far, mine)).toBeGreaterThan(SIMILAR_WITHIN)
  })

  it('filters by goal, level and style together', () => {
    const list = [row({ id: 'a', goals: ['spin'], level: 'advanced', style: 'baseline' }), row({ id: 'b', goals: ['spin'], level: 'beginner' }), row({ id: 'c', goals: ['power'], level: 'advanced' })]
    expect(filterRecipes(list, { goal: 'spin', level: 'advanced' }).map((p) => p.id)).toEqual(['a'])
    expect(filterRecipes(list, { style: 'baseline' }).map((p) => p.id)).toEqual(['a'])
    expect(filterRecipes(list, {})).toHaveLength(3)
  })
})

describe('trust in a recipe', () => {
  const frame = STOCK_RACKETS[0]
  const cfg = { ...config, racketId: frame.id, leadG: { ...emptyLead(), threeNine: 4 } } as PublicSetup['config']
  const { result } = compute({ spec: frame, ...cfg, masses: DEFAULT_ACCESSORY_MASSES })
  const specs = { weightG: result.weightG, balanceCm: result.balanceCm, swingweight: result.swingweight }

  it('numbers that are the recipe’s own hold; made-up ones do not', () => {
    expect(specsHold({ config: cfg, specs }, frame)).toBe(true)
    // An overgrip of another weight is still the same recipe.
    expect(specsHold({ config: cfg, specs: { ...specs, weightG: specs.weightG + 3 } }, frame)).toBe(true)
    expect(specsHold({ config: cfg, specs: { ...specs, swingweight: specs.swingweight + 20 } }, frame)).toBe(false)
  })

  it('a measurement after the lead counts when it agrees, in the same state, since the setup changed', () => {
    const setup = { id: 's', updatedAt: 1000, accessories: { strings: true } }
    const m = (o: object) => ({ date: 2000, weightG: specs.weightG + 1, balanceCm: specs.balanceCm, swingweight: specs.swingweight - 2, strung: true, ...o })
    expect(measurementAfter(setup, [{ setupId: 's', measurements: [m({})] }], specs)).toMatchObject({ date: 2000, strung: true })
    expect(measurementAfter(setup, [{ setupId: 's', measurements: [m({ date: 500 })] }], specs)).toBeNull()
    expect(measurementAfter(setup, [{ setupId: 's', measurements: [m({ strung: false })] }], specs)).toBeNull()
    expect(measurementAfter(setup, [{ setupId: 's', measurements: [m({ weightG: specs.weightG + 15 })] }], specs)).toBeNull()
    expect(measurementAfter(setup, [{ setupId: 'other', measurements: [m({})] }], specs)).toBeNull()
  })

  it('the badge shows only while the measurement agrees with the published numbers', () => {
    const after = { weightG: specs.weightG, balanceCm: specs.balanceCm, swingweight: specs.swingweight, strung: true, date: 1 }
    expect(measuredHolds({ config: cfg, specs, measured_after: after })).toBe(true)
    expect(measuredHolds({ config: cfg, specs, measured_after: { ...after, swingweight: after.swingweight + 15 } })).toBe(false)
    expect(measuredHolds({ config: cfg, specs, measured_after: null })).toBe(false)
  })

  it('a setup without lead is no recipe', () => {
    expect(hasLead({ leadG: emptyLead() })).toBe(false)
    expect(hasLead({ leadG: { ...emptyLead(), handle: 2 } })).toBe(true)
    expect(hasLead({ leadG: emptyLead(), extra: [{ id: 'x', kind: 'hoop', hour: 4, sides: 2, grams: 1 }] })).toBe(true)
  })

  it('recipes whose numbers hold come first, in their order', () => {
    expect(holdingFirst(['a', 'b', 'c', 'd'], (x) => x !== 'b' && x !== 'c')).toEqual(['a', 'd', 'b', 'c'])
  })
})
