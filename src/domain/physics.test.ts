import { describe, expect, it } from 'vitest'
import { feel } from './feel'
import {
  applyMasses,
  centreOfPercussion,
  compute,
  geometry,
  hoopPoint,
  leadPositions,
  ptsHeadLight,
  recoilWeight,
  type Base,
} from './physics'
import { DEFAULT_ACCESSORY_MASSES, emptyLead, type RacketSpec } from './types'

const base: Base = {
  lengthCm: 68.58,
  headSizeSqIn: 98,
  weightG: 300,
  balanceCm: 32,
  swingweight: 290,
  twistweight: 13,
}

const spec: RacketSpec = { lengthCm: 68.58, headSizeSqIn: 98, weightG: 305, balanceCm: 31.5, swingweight: 285, ra: 66 }
const noAcc = { strings: false, leatherGrip: false, overgrip: false, dampener: false }

describe('physics', () => {
  it('adds a point mass: weight, balance and swingweight by hand', () => {
    const s = applyMasses(base, [{ grams: 10, x: 60, y: 0 }])
    expect(s.weightG).toBe(310)
    expect(s.balanceCm).toBeCloseTo((300 * 32 + 10 * 60) / 310, 6)
    expect(s.swingweight).toBeCloseTo(290 + 0.01 * 50 * 50, 6) // 315
    expect(s.twistweight).toBeCloseTo(13, 6)
  })

  it('mass off the centre line adds twistweight m·y²', () => {
    const s = applyMasses(base, [{ grams: 4, x: 50, y: 12 }])
    expect(s.twistweight).toBeCloseTo(13 + 0.004 * 144, 6)
  })

  it('points head light use 1/8 inch per point', () => {
    expect(ptsHeadLight(68.58, 32)).toBeCloseTo((34.29 - 32) / 0.3175, 6)
    expect(ptsHeadLight(68.58, 34.29)).toBeCloseTo(0, 6)
  })

  it('recoil weight is the inertia about the balance point', () => {
    expect(recoilWeight(320, 330, 32.5)).toBeCloseTo(320 - 0.33 * 22.5 * 22.5, 6)
  })

  it('sweet spot: q = SW / (M·d) from the axis, near the head centre for a typical frame', () => {
    expect(centreOfPercussion(320, 330, 32.5)).toBeCloseTo(10 + 320 / (0.33 * 22.5), 6)
    const s = applyMasses(base, [])
    const g = geometry(68.58, 98)
    expect(Math.abs(s.sweetSpotCm - g.xc)).toBeLessThan(6)
  })

  it('sweet spot moves up with tip lead; handle lead barely moves it', () => {
    const s0 = applyMasses(base, []).sweetSpotCm
    const tip = applyMasses(base, [{ grams: 6, x: 67.5, y: 0 }]).sweetSpotCm
    const handle = applyMasses(base, [{ grams: 10, x: 6, y: 0 }]).sweetSpotCm
    // By hand: I = 290 + 0.006·57.5², M·d = 0.3·22 + 0.006·57.5
    expect(tip).toBeCloseTo(10 + (290 + 0.006 * 57.5 ** 2) / (0.3 * 22 + 0.006 * 57.5), 6)
    expect(tip - s0).toBeGreaterThan(0.5)
    expect(Math.abs(handle - s0)).toBeLessThan(0.5)
  })

  it('custom hoop positions: 3h equals the 3/9 position, 12h is the top of the hoop', () => {
    const g = geometry(68.58, 98)
    const p = leadPositions(g)
    const three = hoopPoint(g, 3)
    expect(three.x).toBeCloseTo(p.threeNine.x, 6)
    expect(three.y).toBeCloseTo(p.threeNine.y, 6)
    const two = hoopPoint(g, 2)
    expect(two.x).toBeCloseTo(p.tenTwo.x, 6)
    expect(two.y).toBeCloseTo(p.tenTwo.y, 6)
    expect(hoopPoint(g, 6).x).toBeCloseTo(g.xc - g.a, 6)
    // 4h and 8h mirror each other.
    expect(hoopPoint(g, 4).x).toBeCloseTo(hoopPoint(g, 8).x, 6)
    expect(hoopPoint(g, 4).y).toBeCloseTo(hoopPoint(g, 8).y, 6)
  })

  it('custom lead counts in the result like the fixed positions', () => {
    const common = { spec, baseMode: 'reference' as const, measured: {}, accessories: noAcc, masses: DEFAULT_ACCESSORY_MASSES }
    const fixed = compute({ ...common, leadG: { ...emptyLead(), threeNine: 4 } }).result
    const custom = compute({ ...common, leadG: emptyLead(), extra: [{ id: 'a', kind: 'hoop', hour: 3, sides: 2, grams: 4 }] }).result
    expect(custom.weightG).toBeCloseTo(fixed.weightG, 6)
    expect(custom.swingweight).toBeCloseTo(fixed.swingweight, 6)
    expect(custom.twistweight).toBeCloseTo(fixed.twistweight!, 6)
    const shaft = compute({ ...common, leadG: emptyLead(), extra: [{ id: 'b', kind: 'shaft', cm: 25, sides: 1, grams: 5 }] }).result
    expect(shaft.weightG).toBe(310)
    expect(shaft.twistweight).toBeCloseTo(compute({ ...common, leadG: emptyLead() }).result.twistweight!, 6)
  })

  it('places lead inside the racket, tip beyond 3/9h, throat below head centre', () => {
    const g = geometry(68.58, 98)
    const p = leadPositions(g)
    expect(p.tip.x).toBeLessThan(68.58)
    expect(p.tip.x).toBeGreaterThan(p.tenTwo.x)
    expect(p.tenTwo.x).toBeGreaterThan(p.threeNine.x)
    expect(p.threeNine.x).toBeGreaterThan(p.throat.x)
    expect(p.throat.x).toBeGreaterThan(p.handle.x)
    expect(p.threeNine.y).toBeGreaterThan(11)
    expect(p.threeNine.y).toBeLessThan(14)
  })

  it('stringing a 98 adds the string mass and roughly 25 to 33 swingweight', () => {
    const { base: b, result } = compute({
      spec,
      baseMode: 'reference',
      measured: {},
      accessories: { ...noAcc, strings: true },
      leadG: emptyLead(),
      masses: DEFAULT_ACCESSORY_MASSES,
    })
    expect(result.weightG - b.weightG).toBe(DEFAULT_ACCESSORY_MASSES.strings)
    const dSw = result.swingweight - b.swingweight
    expect(dSw).toBeGreaterThan(25)
    expect(dSw).toBeLessThan(33)
    expect(result.balanceCm).toBeGreaterThan(b.balanceCm)
  })

  it('handle lead lowers the balance and barely moves swingweight', () => {
    const { base: b, result } = compute({
      spec,
      baseMode: 'reference',
      measured: {},
      accessories: noAcc,
      leadG: { ...emptyLead(), handle: 10 },
      masses: DEFAULT_ACCESSORY_MASSES,
    })
    expect(result.balanceCm).toBeLessThan(b.balanceCm)
    expect(result.swingweight - b.swingweight).toBeLessThan(0.5)
  })

  it('measured mode overrides reference values that were given', () => {
    const { base: b } = compute({
      spec,
      baseMode: 'measured',
      measured: { weightG: 322, swingweight: 318 },
      accessories: noAcc,
      leadG: emptyLead(),
      masses: DEFAULT_ACCESSORY_MASSES,
    })
    expect(b.weightG).toBe(322)
    expect(b.swingweight).toBe(318)
    expect(b.balanceCm).toBe(31.5)
    expect(b.twistweightEstimated).toBe(true)
  })

  it('feel: more swingweight means more power and less manoeuvrability', () => {
    const light = applyMasses(base, [])
    const heavy = applyMasses(base, [{ grams: 6, x: 67.5, y: 0 }])
    const fl = feel(light, 98)
    const fh = feel(heavy, 98)
    expect(fh.power).toBeGreaterThan(fl.power)
    expect(fh.plow).toBeGreaterThan(fl.plow)
    expect(fh.manoeuvrability).toBeLessThan(fl.manoeuvrability)
    for (const v of Object.values(fh)) {
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(95)
    }
  })
})
