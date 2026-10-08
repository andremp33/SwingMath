import { applyMasses, geometry, leadPositions, SW_AXIS_CM, type Base } from './physics'
import { emptyLead, POSITIONS, type LeadMap, type Position, type Specs } from './types'

export interface Target {
  weightG?: number
  balanceCm?: number
  swingweight?: number
  twistweight?: number
}
export type TargetKey = keyof Target

/** How far off counts as "one unit" of error for each spec. */
export const TOLERANCE: Record<TargetKey, number> = {
  weightG: 1,
  balanceCm: 0.1,
  swingweight: 1,
  twistweight: 0.2,
}

export interface MatchOptions {
  allowed?: Position[]
  maxPerPositionG?: number
  stepG?: number
}

export interface MatchResult {
  lead: LeadMap
  totalG: number
  result: Specs
  errors: Partial<Record<TargetKey, number>>
  /** 0-100. 100 = every target spec hit within rounding. */
  matchPct: number
  /** The target needs less of something than the frame already has. */
  unreachable: TargetKey[]
}

interface Row {
  coef: number[]
  rhs: number
  scale: number
}

function buildRows(base: Base, t: Target, pos: Position[]): Row[] {
  const g = geometry(base.lengthCm, base.headSizeSqIn)
  const p = leadPositions(g)
  const rows: Row[] = []
  const wt = t.weightG ?? base.weightG
  if (t.weightG !== undefined) {
    rows.push({ coef: pos.map(() => 1), rhs: t.weightG - base.weightG, scale: 1 / TOLERANCE.weightG })
  }
  if (t.balanceCm !== undefined) {
    const bt = t.balanceCm
    rows.push({
      coef: pos.map((k) => p[k].x - bt),
      rhs: base.weightG * (bt - base.balanceCm),
      scale: 1 / (wt * TOLERANCE.balanceCm),
    })
  }
  if (t.swingweight !== undefined) {
    rows.push({
      coef: pos.map((k) => (p[k].x - SW_AXIS_CM) ** 2 / 1000),
      rhs: t.swingweight - base.swingweight,
      scale: 1 / TOLERANCE.swingweight,
    })
  }
  if (t.twistweight !== undefined && base.twistweight !== undefined) {
    rows.push({
      coef: pos.map((k) => p[k].y ** 2 / 1000),
      rhs: t.twistweight - base.twistweight,
      scale: 1 / TOLERANCE.twistweight,
    })
  }
  return rows
}

function residual(rows: Row[], m: number[]): number {
  let r = 0
  for (const row of rows) {
    let s = -row.rhs
    for (let i = 0; i < m.length; i++) s += row.coef[i] * m[i]
    r += (s * row.scale) ** 2
  }
  return r
}

/** Solves the small symmetric system M x = v by Gaussian elimination. */
function solve(M: number[][], v: number[]): number[] | null {
  const n = v.length
  const A = M.map((r, i) => [...r, v[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    if (Math.abs(A[piv][c]) < 1e-12) return null
    ;[A[c], A[piv]] = [A[piv], A[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]
    }
  }
  return A.map((r, i) => r[n] / r[i])
}

/** Least squares on a subset of columns, lightly regularised so
 *  under-determined systems pick the smallest masses. */
function leastSquares(rows: Row[], cols: number[]): number[] | null {
  const n = cols.length
  const M = Array.from({ length: n }, () => new Array(n).fill(0))
  const v = new Array(n).fill(0)
  for (const row of rows) {
    const s2 = row.scale * row.scale
    for (let i = 0; i < n; i++) {
      v[i] += row.coef[cols[i]] * row.rhs * s2
      for (let j = 0; j < n; j++) M[i][j] += row.coef[cols[i]] * row.coef[cols[j]] * s2
    }
  }
  for (let i = 0; i < n; i++) M[i][i] += 1e-4
  return solve(M, v)
}

/** Non-negative least squares by trying every active set (2^5 = 32). */
function nnls(rows: Row[], nVars: number, max: number): number[] {
  let best = new Array(nVars).fill(0)
  let bestR = residual(rows, best)
  let bestSum = 0
  for (let mask = 1; mask < 1 << nVars; mask++) {
    const cols = [...Array(nVars).keys()].filter((i) => mask & (1 << i))
    const sol = leastSquares(rows, cols)
    if (!sol || sol.some((v) => v < -1e-9)) continue
    const m = new Array(nVars).fill(0)
    cols.forEach((c, i) => (m[c] = Math.min(max, Math.max(0, sol[i]))))
    const r = residual(rows, m)
    const sum = m.reduce((a, b) => a + b, 0)
    if (r < bestR - 1e-9 || (Math.abs(r - bestR) <= 1e-9 && sum < bestSum)) {
      best = m
      bestR = r
      bestSum = sum
    }
  }
  return best
}

/** Rounds to the scale step, then nudges single positions while it helps. */
function roundAndRefine(rows: Row[], m: number[], step: number, max: number): number[] {
  const out = m.map((v) => Math.round(v / step) * step)
  let r = residual(rows, out)
  for (let pass = 0; pass < 20; pass++) {
    let improved = false
    for (let i = 0; i < out.length; i++) {
      for (const d of [step, -step]) {
        const v = out[i] + d
        if (v < 0 || v > max) continue
        const trial = [...out]
        trial[i] = v
        const tr = residual(rows, trial)
        if (tr < r - 1e-9) {
          out[i] = v
          r = tr
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return out
}

export function scoreErrors(errors: Partial<Record<TargetKey, number>>): number {
  const keys = Object.keys(errors) as TargetKey[]
  if (keys.length === 0) return 100
  const s = keys.reduce((acc, k) => acc + Math.max(0, 1 - Math.abs(errors[k]!) / (10 * TOLERANCE[k])), 0)
  return Math.round((s / keys.length) * 1000) / 10
}

export function errorsFor(result: Specs, t: Target): Partial<Record<TargetKey, number>> {
  const e: Partial<Record<TargetKey, number>> = {}
  if (t.weightG !== undefined) e.weightG = result.weightG - t.weightG
  if (t.balanceCm !== undefined) e.balanceCm = result.balanceCm - t.balanceCm
  if (t.swingweight !== undefined) e.swingweight = result.swingweight - t.swingweight
  if (t.twistweight !== undefined && result.twistweight !== undefined) e.twistweight = result.twistweight - t.twistweight
  return e
}

/** Finds the lead per position that brings `base` closest to `target`. */
export function solveTarget(base: Base, target: Target, opts: MatchOptions = {}): MatchResult {
  const allowed = opts.allowed ?? [...POSITIONS]
  const max = opts.maxPerPositionG ?? 30
  const step = opts.stepG ?? 0.5
  const rows = buildRows(base, target, allowed)
  const raw = nnls(rows, allowed.length, max)
  const grams = roundAndRefine(rows, raw, step, max)

  const lead = emptyLead()
  allowed.forEach((p, i) => (lead[p] = grams[i]))
  const g = geometry(base.lengthCm, base.headSizeSqIn)
  const pos = leadPositions(g)
  const result = applyMasses(
    base,
    allowed.filter((p) => lead[p] > 0).map((p) => ({ grams: lead[p], x: pos[p].x, y: pos[p].y })),
  )
  const errors = errorsFor(result, target)

  const unreachable: TargetKey[] = []
  if (target.weightG !== undefined && target.weightG < base.weightG - TOLERANCE.weightG) unreachable.push('weightG')
  if (target.swingweight !== undefined && target.swingweight < base.swingweight - TOLERANCE.swingweight)
    unreachable.push('swingweight')
  if (
    target.twistweight !== undefined &&
    base.twistweight !== undefined &&
    target.twistweight < base.twistweight - TOLERANCE.twistweight
  )
    unreachable.push('twistweight')

  return {
    lead,
    totalG: grams.reduce((a, b) => a + b, 0),
    result,
    errors,
    matchPct: scoreErrors(errors),
    unreachable,
  }
}

export interface BatchResult {
  target: Target
  plans: MatchResult[]
  /** Lowest match % across the rackets. */
  matchPct: number
}

/**
 * Makes 2-3 frames feel the same. Lead only adds, so the common target takes
 * the highest weight, swingweight and twistweight, then searches the balance
 * that every frame can reach best.
 */
export function matchRackets(bases: Base[], opts: MatchOptions = {}): BatchResult {
  const weightG = Math.max(...bases.map((b) => b.weightG))
  const swingweight = Math.max(...bases.map((b) => b.swingweight))
  const useTw = bases.every((b) => b.twistweight !== undefined && !b.twistweightEstimated)
  const twistweight = useTw ? Math.max(...bases.map((b) => b.twistweight!)) : undefined

  const lo = Math.min(...bases.map((b) => b.balanceCm)) - 1
  const hi = Math.max(...bases.map((b) => b.balanceCm)) + 1
  let best: BatchResult | null = null
  let bestCost = Infinity
  const tryTarget = (extra: number, bal: number) => {
    const target: Target = { weightG: weightG + extra, balanceCm: Math.round(bal * 100) / 100, swingweight, twistweight }
    const plans = bases.map((b) => solveTarget(b, target, opts))
    const cost = plans.reduce((acc, p) => acc + (100 - p.matchPct) ** 2 + p.totalG * 0.05, 0)
    if (cost < bestCost) {
      bestCost = cost
      best = { target, plans, matchPct: Math.min(...plans.map((p) => p.matchPct)) }
    }
  }
  // Even the heaviest frame may need a little lead to move its balance, so
  // the target weight gets a few grams of slack. Search coarse, then refine
  // around the best point: about 5x fewer solves than a fine grid.
  for (let extra = 0; extra <= 8; extra += 2) for (let bal = lo; bal <= hi + 1e-9; bal += 0.5) tryTarget(extra, bal)
  const c = best!.target
  const extra0 = c.weightG! - weightG
  for (let extra = Math.max(0, extra0 - 2); extra <= extra0 + 2; extra += 1)
    for (let bal = c.balanceCm! - 0.5; bal <= c.balanceCm! + 0.5 + 1e-9; bal += 0.1) tryTarget(extra, bal)
  return best!
}
