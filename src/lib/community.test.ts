import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { emptyLead } from '../domain/types'
import { parsePublicSetups, rankPublicSetups, republishPlan, roundResults, type PublicSetup } from './community'

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
    user_id: 'u',
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
    ...over,
  }) as PublicSetup

describe('community recipes', () => {
  it('ranks partners first, then recipes with results by rating, then copies, then newest', () => {
    const list = [
      row({ id: 'copied', copies: 9 }),
      row({ id: 'new', created_at: '2026-10-12T00:00:00Z' }),
      row({ id: 'old', created_at: '2026-10-01T00:00:00Z' }),
      row({ id: 'good', results: { sessions: 5, hours: 4, avg: { overall: 4.6 } } }),
      row({ id: 'ok', results: { sessions: 8, hours: 6, avg: { overall: 3.9 } } }),
      // Too few sessions to count as results.
      row({ id: 'thin', results: { sessions: 2, hours: 1, avg: { overall: 5 } } }),
      row({ id: 'shop', partner: 'Loja do Bairro' }),
    ]
    expect(rankPublicSetups(list).map((p) => p.id)).toEqual(['shop', 'good', 'ok', 'copied', 'new', 'thin', 'old'])
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
    const { goals: _g, level: _l, style: _s, results: _r, setup_ref: _f, partner: _p, ...old } = row()
    const [p] = parsePublicSetups([old])
    expect(p).toMatchObject({ goals: [], level: null, results: null, partner: null })
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
