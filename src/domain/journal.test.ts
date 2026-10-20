import { describe, expect, it } from 'vitest'
import {
  currentStringings,
  dueForRestring,
  hoursOn,
  insights,
  isFinished,
  latestOf,
  lifeOf,
  linkOwned,
  nextStringing,
  personalLife,
  restringDue,
  sessionScore,
  setupResults,
  stringingReport,
  weeklyHours,
  type OwnedRacket,
  type Session,
  type Stringing,
} from './journal'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 9)

const stringing = (id: string, label: string, daysAgo: number): Stringing => ({
  id,
  label,
  racketId: 'stock-x',
  date: NOW - daysAgo * DAY,
  bed: { mains: { material: 'poly', tensionKg: 23 } },
  createdAt: NOW - daysAgo * DAY,
  updatedAt: 0,
})
const session = (stringingId: string, minutes: number, daysAgo: number, overall?: number, armPain = false): Session => ({
  id: `${stringingId}-${daysAgo}-${minutes}`,
  date: NOW - daysAgo * DAY,
  minutes,
  kind: 'practice',
  stringingId,
  ratings: overall ? { overall } : {},
  armPain,
  createdAt: 0,
  updatedAt: 0,
})

describe('journal', () => {
  const all = [stringing('a1', 'Aero #1', 30), stringing('a2', 'Aero #1', 5), stringing('b1', 'Blade', 10)]
  const sessions = [session('a1', 90, 20, 3), session('a2', 120, 3, 5), session('a2', 60, 1, 4, true), session('b1', 60, 2)]

  it('adds up hours per stringing', () => {
    expect(hoursOn('a2', sessions)).toBe(3)
    expect(hoursOn('zz', sessions)).toBe(0)
  })

  it('keeps only the latest stringing of each racket', () => {
    expect(currentStringings(all).map((s) => s.id)).toEqual(['a2', 'b1'])
  })

  it('life uses the hours and days of that stringing only', () => {
    const l = lifeOf(all[1], sessions, NOW)
    expect(l.hours).toBe(3)
    expect(l.days).toBeCloseTo(5, 6)
    expect(l.used).toBeGreaterThan(0)
    expect(l.used).toBeLessThan(1)
  })

  it('flags rackets past their strings’ life', () => {
    const heavy = [...sessions, session('b1', 18 * 60, 1)]
    expect(dueForRestring(all, heavy, NOW).map((s) => s.id)).toEqual(['b1'])
  })

  it('ranks stringings by average overall rating', () => {
    const r = insights(all, sessions)
    expect(r[0].stringing.id).toBe('a2')
    expect(r[0].avg.overall).toBe(4.5)
    expect(r[0].armPainShare).toBe(0.5)
    expect(r.find((i) => i.stringing.id === 'b1')?.avg.overall).toBeUndefined()
  })

  it('groups named strings at the same tension, whatever the racket', () => {
    const named = (id: string, name: string | undefined, kg: number, daysAgo: number): Stringing => ({
      ...stringing(id, id, daysAgo),
      bed: { mains: { material: 'poly', tensionKg: kg, name } },
    })
    const list = [named('x1', 'Babolat RPM Blast', 23, 40), named('x2', 'babolat  rpm blast', 23, 10), named('x3', 'Babolat RPM Blast', 24, 5), named('y1', undefined, 23, 8), named('y2', undefined, 23, 2)]
    const play = [session('x1', 60, 30, 4), session('x2', 60, 5, 2), session('x3', 60, 4, 5), session('y1', 60, 3, 3), session('y2', 60, 1, 3)]
    const r = insights(list, play)
    // RPM Blast at 23 kg twice, as one: (4 + 2) / 2; at 24 kg on its own.
    const at23 = r.find((i) => i.stringings.length === 2)!
    expect(at23.stringings.map((s) => s.id).sort()).toEqual(['x1', 'x2'])
    expect(at23.stringing.id).toBe('x2')
    expect(at23.avg.overall).toBe(3)
    expect(at23.sessions).toBe(2)
    expect(r.find((i) => i.stringing.id === 'x3')?.stringings).toHaveLength(1)
    // Without a name, each stringing stays on its own.
    expect(r.filter((i) => i.stringing.id.startsWith('y'))).toHaveLength(2)
    expect(r[0].stringing.id).toBe('x3')
  })

  it('buckets hours by week, oldest first', () => {
    const w = weeklyHours(sessions, 4, NOW)
    expect(w).toEqual([0, 1.5, 0, 4])
  })
})

describe('owned rackets', () => {
  const old = [stringing('a1', 'Aero #1', 30), stringing('a2', ' aero #1 ', 5), stringing('b1', 'Blade', 10)]
  let k = 0
  const newId = () => `o${++k}`

  it('older journals get one owned racket per name, case and spaces aside', () => {
    const { created, linked } = linkOwned(old, [], newId, NOW)
    expect(created.map((o) => o.name).sort()).toEqual(['Blade', 'aero #1'])
    const aero = created.find((o) => o.name === 'aero #1')!
    expect(linked.filter((s) => s.ownedId === aero.id).map((s) => s.id).sort()).toEqual(['a1', 'a2'])
    // The latest stringing names it and gives it its frame.
    expect(aero.racketId).toBe('stock-x')
  })

  it('an existing racket with that name is reused', () => {
    const mine: OwnedRacket = { id: 'mine', name: 'Blade', racketId: 'stock-y', createdAt: 0, updatedAt: 0 }
    const { created, linked } = linkOwned(old, [mine], newId, NOW)
    expect(created.some((o) => o.name === 'Blade')).toBe(false)
    expect(linked.find((s) => s.id === 'b1')?.ownedId).toBe('mine')
  })

  it('each owned racket counts as one, whatever its stringings were called', () => {
    const renamed = [{ ...stringing('x1', 'Old name', 9), ownedId: 'r' }, { ...stringing('x2', 'New name', 2), ownedId: 'r' }]
    expect(currentStringings(renamed).map((s) => s.id)).toEqual(['x2'])
    expect(latestOf('r', renamed)?.id).toBe('x2')
  })
})

describe('setup results', () => {
  const owned: OwnedRacket[] = [
    { id: 'o1', name: 'Aero de jogo', racketId: 'stock-x', setupId: 'torneio', createdAt: 0, updatedAt: 0 },
    { id: 'o2', name: 'Aero treino', racketId: 'stock-x', createdAt: 0, updatedAt: 0 },
  ]
  // Named on the stringing, through the racket, and on a racket built to something else.
  const st = [
    { ...stringing('direct', 'x', 20), setupId: 'torneio' },
    { ...stringing('via-racket', 'x', 10), ownedId: 'o1' },
    { ...stringing('other', 'x', 5), ownedId: 'o2' },
    { ...stringing('named-elsewhere', 'x', 4), ownedId: 'o1', setupId: 'leve' },
  ]

  it('links sessions by the stringing’s setup, or by its racket’s', () => {
    const s = [session('direct', 60, 15, 4), session('via-racket', 90, 8, 5), session('via-racket', 30, 7), session('other', 60, 3, 1), session('named-elsewhere', 60, 2, 1)]
    const r = setupResults('torneio', owned, st, s)
    expect(r).toEqual({ sessions: 3, hours: 3, avg: { overall: 4.5 } })
  })

  it('needs at least 3 sessions', () => {
    expect(setupResults('torneio', owned, st, [session('direct', 60, 15, 4), session('via-racket', 60, 8, 5)])).toBeNull()
    expect(setupResults('nothing', owned, st, [])).toBeNull()
  })

  it('never carries arm pain', () => {
    const s = [session('direct', 60, 15, 4, true), session('direct', 60, 14, 4, true), session('direct', 60, 13, 4)]
    expect(setupResults('torneio', owned, st, s)).not.toHaveProperty('armPainShare')
  })
})

describe('restring date', () => {
  // Poly: 18 playing hours or 8 weeks on the racket, whichever comes first.
  const st = (daysAgo: number) => stringing('r', 'x', daysAgo)

  it('before any session, the player’s hours a week set the pace', () => {
    expect(restringDue(st(0), [], 3, NOW)).toBe(NOW + 42 * DAY)
    // Little play: the 8 weeks come first.
    expect(restringDue(st(0), [], 1, NOW)).toBe(NOW + 56 * DAY)
  })

  it('with no sessions and no estimate, the weeks alone', () => {
    expect(restringDue(st(10), [], undefined, NOW)).toBe(NOW - 10 * DAY + 56 * DAY)
  })

  it('once sessions are logged, they set the pace and the estimate no longer counts', () => {
    const s = [session('r', 240, 10), session('r', 120, 3)]
    // 6 h in 14 days; 12 h left at that pace is 28 days.
    expect(restringDue(st(14), s, 3, NOW)).toBeCloseTo(NOW + 28 * DAY, -3)
    expect(restringDue(st(14), s, 20, NOW)).toBeCloseTo(NOW + 28 * DAY, -3)
  })

  it('a long first session is spread over a week, and a spent stringing is due now', () => {
    expect(restringDue(st(1), [session('r', 180, 0)], undefined, NOW)).toBeCloseTo(NOW + 35 * DAY, -3)
    expect(restringDue(st(20), [session('r', 20 * 60, 5)], undefined, NOW)).toBe(NOW)
  })
})

/** Hour-long sessions on one stringing, oldest first, rated in turn. */
const played = (id: string, scores: (number | undefined)[], pain: number[] = []) =>
  scores.map((overall, i) => ({ ...session(id, 60, 40 - i, overall, pain.includes(i)), id: `${id}-${i}`, createdAt: i }))

describe('stringing report', () => {
  it('scores a session by its overall rating, else power, control and spin', () => {
    const s = session('a', 60, 1)
    expect(sessionScore({ ...s, ratings: { overall: 2, power: 5 } })).toBe(2)
    expect(sessionScore({ ...s, ratings: { power: 5, control: 3, spin: 4, comfort: 1 } })).toBe(4)
    expect(sessionScore({ ...s, ratings: { comfort: 4 } })).toBeUndefined()
  })

  it('adds up the life, block by block, and finds where it went dead', () => {
    const st = stringing('r', 'x', 45)
    // 0-3 h: 5; 3-6 h: 4.7 (only 0.3 down); 6-9 h: 4 (1 down); 9-12 h: 3.
    const s = played('r', [5, 5, 5, 5, 4, 5, 4, 4, 4, 3, 3, 3], [7])
    const r = stringingReport(st, s)
    expect(r.hours).toBe(12)
    expect(r.sessions).toBe(12)
    expect(r.blocks.map((b) => b.fromHours)).toEqual([0, 3, 6, 9])
    expect(r.blocks[1].score).toBeCloseTo(14 / 3, 6)
    expect(r.deathHours).toBe(6)
    expect(r.armPainAtHours).toEqual([7])
  })

  it('needs two rated sessions in a block to call it', () => {
    const st = stringing('r', 'x', 45)
    expect(stringingReport(st, played('r', [5, undefined, undefined, 2, 2, 2])).deathHours).toBeUndefined()
    expect(stringingReport(st, played('r', [5, 5, 5, 2, undefined, undefined])).deathHours).toBeUndefined()
    // Without overall ratings, power, control and spin count.
    const parts = played('r', [undefined, undefined, undefined, undefined, undefined, undefined]).map((x, i) => ({ ...x, ratings: i < 3 ? { power: 5, control: 5 } : { spin: 3 } }))
    expect(stringingReport(st, parts).deathHours).toBe(3)
  })
})

describe('personal string life', () => {
  const on = (id: string, daysAgo: number, material: 'poly' | 'multi' = 'poly'): Stringing => ({ ...stringing(id, 'Aero', daysAgo), ownedId: 'o', bed: { mains: { material, tensionKg: 23 } } })
  const all = [on('s1', 90), on('s2', 60), on('m1', 50, 'multi'), on('now', 5)]
  // s1 went dead at 6 h, s2 at 9 h; the multi at 3 h; the current one is not finished.
  const s = [...played('s1', [5, 5, 5, 5, 5, 5, 4, 4, 4]), ...played('s2', [5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3]), ...played('m1', [5, 5, 5, 3, 3, 3])]

  it('is the median of where the finished stringings of that material went dead', () => {
    expect(isFinished(all[0], all)).toBe(true)
    expect(isFinished(all[3], all)).toBe(false)
    expect(personalLife(all[3].bed, all, s)).toBe(7.5)
    expect(personalLife({ mains: { material: 'multi', tensionKg: 23 } }, all, s)).toBe(3)
    expect(personalLife({ mains: { material: 'gut', tensionKg: 23 } }, all, s)).toBeUndefined()
  })

  it('sets the restring date: the player’s hours first, then their own, then the material’s', () => {
    const now = all[3]
    // 7 h a week is an hour a day.
    expect(restringDue({ ...now, lifeHours: 12 }, s, 7, NOW, all)).toBeCloseTo(now.date + 12 * DAY, -3)
    expect(restringDue(now, s, 7, NOW, all)).toBeCloseTo(now.date + 7.5 * DAY, -3)
    expect(restringDue(now, s, 7, NOW)).toBeCloseTo(now.date + 18 * DAY, -3)
    expect(lifeOf(now, s, NOW, all).hoursLeft).toBeLessThan(7.5)
  })
})

describe('next stringing', () => {
  const at = (id: string, kg: number, daysAgo: number, lifeHours?: number): Stringing => ({
    ...stringing(id, 'Aero', daysAgo),
    ownedId: 'o',
    lifeHours,
    bed: { mains: { material: 'poly', tensionKg: kg, name: 'RPM Blast' } },
  })

  it('without enough sessions, keeps the tension and says so', () => {
    const st = at('a', 23, 10)
    expect(nextStringing(st, [st], played('a', [4]))).toEqual({ tensionKg: 23, why: 'noData', armPainShare: 0, changeAtHours: 18 })
    expect(nextStringing(st, [st], played('a', [4, 4, 5])).why).toBe('keep')
  })

  it('with two tensions tried, the better rated one', () => {
    const all = [at('a', 21, 60), at('b', 23, 10)]
    const s = [...played('a', [5, 4, 5]), ...played('b', [3, 3, 4])]
    expect(nextStringing(all[1], all, s)).toMatchObject({ tensionKg: 21, why: 'best' })
    // Other strings do not count.
    const other = [{ ...all[0], bed: { mains: { ...all[0].bed.mains, name: 'Hyper-G' } } }, all[1]]
    expect(nextStringing(all[1], other, s).why).toBe('keep')
  })

  it('a kilo less when the arm hurt in a quarter of the sessions, and more than elsewhere', () => {
    const st = at('a', 23, 10)
    expect(nextStringing(st, [st], played('a', [4, 4, 4, 4], [2]))).toMatchObject({ tensionKg: 22, why: 'armPain', armPainShare: 0.25 })
    // It hurt more at another tension: not the tension, then.
    const all = [at('z', 21, 60), st]
    const s = [...played('z', [undefined, undefined, undefined, undefined], [0, 1]), ...played('a', [4, 4, 4, 4], [2])]
    expect(nextStringing(st, all, s)).toMatchObject({ tensionKg: 23, why: 'keep' })
  })

  it('only sessions on live strings count', () => {
    const st = at('a', 23, 10, 2)
    expect(nextStringing(st, [st], played('a', [4, 4, 1, 1], [2, 3]))).toMatchObject({ tensionKg: 23, why: 'noData', changeAtHours: 2 })
  })
})

describe('what plays best', () => {
  it('by kind of session, and only while the strings were alive', () => {
    const a = { ...stringing('a', 'A', 30), lifeHours: 2 }
    const s = [...played('a', [5, 5, 1, 1]), { ...session('a', 60, 0, 2), kind: 'match' as const }]
    expect(insights([a], s)[0].avg.overall).toBe(2.8)
    expect(insights([a], s, { withinLife: true })[0].avg.overall).toBe(5)
    expect(insights([a], s, { kind: 'match' })[0]).toMatchObject({ sessions: 1, avg: { overall: 2 } })
  })

  it('calls it noise with fewer than 3 sessions or less than 0.3 apart', () => {
    const list = [stringing('a', 'A', 30), stringing('b', 'B', 20), stringing('c', 'C', 10)]
    const s = [...played('a', [5, 5, 4]), ...played('b', [4, 4, 4]), ...played('c', [3, 3])]
    expect(insights(list, s).map((r) => [r.stringing.id, r.noise])).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ])
    const close = [...played('a', [4, 4, 4, 4]), ...played('b', [4, 4, 4, 5])]
    expect(insights(list, close).every((r) => r.noise)).toBe(true)
  })
})
