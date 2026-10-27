import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useId, useState } from 'react'
import { defaultConfig, useStore } from '../data/store'
import { compute, geometry, leadPositions } from '../domain/physics'
import { emptyLead, type LeadMap, type Position } from '../domain/types'
import { fmt, useT } from '../i18n'
import { useLanding } from '../i18n/landing'
import { fmtNum, fmtSigned } from '../lib/format'
import { useUnits } from '../lib/units'
import { cx } from '../ui/basics'
import { DEMO_RACKETS } from './demoRackets'

/**
 * The website's one live thing: lead on a racket from the library, worked
 * out by the app's own physics, as a cropped piece of the app's interface.
 */

const SHOWN: Position[] = ['tip', 'threeNine', 'throat', 'handle']
const STEP = 0.5
const MAX = 12

export function LeadDemo() {
  const t = useLanding()
  const ta = useT()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const units = useUnits()
  const selectId = useId()
  const [id, setId] = useState(DEMO_RACKETS[0].id)
  const [lead, setLead] = useState<LeadMap>({ ...emptyLead(), tip: 2, threeNine: 2 })
  const racket = DEMO_RACKETS.find((r) => r.id === id) ?? DEMO_RACKETS[0]
  // Differences from the same racket as played (strung, with an overgrip) without lead.
  const base = compute({ spec: racket, ...defaultConfig(racket.id), masses }).result
  const { result } = compute({ spec: racket, ...defaultConfig(racket.id), leadG: lead, masses })
  const total = SHOWN.reduce((s, p) => s + lead[p], 0)
  const bump = (p: Position, d: number) => setLead((l) => ({ ...l, [p]: Math.min(MAX, Math.max(0, l[p] + d)) }))

  const readouts = [
    { label: ta.spec.weight, value: units.weight(result.weightG), unit: units.weightUnit, delta: units.weightDelta(result.weightG - base.weightG) },
    { label: ta.spec.balance, value: units.balance(result.balanceCm), unit: units.balanceUnit, delta: units.balanceDelta(result.balanceCm - base.balanceCm) },
    { label: ta.spec.swingweight, value: fmtNum(result.swingweight, 0, lang), unit: ta.units.kgcm2, delta: fmtSigned(result.swingweight - base.swingweight, 1, lang) },
    { label: ta.spec.sweetSpot, value: units.length(result.sweetSpotCm), unit: units.lengthUnit, delta: units.balanceDelta(result.sweetSpotCm - base.sweetSpotCm, 0) },
  ]

  return (
    <div data-ui className="site-fragment w-full max-w-[640px] rounded-lg border border-border bg-bg text-text">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:px-5">
        <div className="min-w-0 sm:flex-1">
          <label htmlFor={selectId} className="block text-[13px] text-muted">
            {t.demoRacket}
          </label>
          <select id={selectId} value={id} onChange={(e) => setId(e.target.value)} className="mt-1 h-10 w-full max-w-[320px] rounded-md border border-border-input bg-surface px-3 text-[15px] text-text">
            {DEMO_RACKETS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.brand} {r.model}
                {r.year ? ` (${r.year})` : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[13px] text-muted sm:pb-2">{t.demoNote}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pt-4 sm:grid-cols-4 sm:px-5" aria-live="polite">
        {readouts.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="truncate text-[13px] text-muted">{r.label}</dt>
            <dd>
              <span className="readout text-[22px] leading-7">{r.value}</span> <span className="text-[13px] text-muted">{r.unit}</span>
              <span className={cx('num block text-[13px]', r.delta.startsWith('+') ? 'text-accent-text' : 'text-muted')}>{r.delta}</span>
            </dd>
          </div>
        ))}
      </dl>

      <RacketDrawing lengthCm={racket.lengthCm} headSizeSqIn={racket.headSizeSqIn} lead={lead} balanceCm={result.balanceCm} baseBalanceCm={base.balanceCm} sweetSpotCm={result.sweetSpotCm} />

      <div className="flex items-center justify-between gap-3 px-4 sm:px-5">
        <h3 className="text-[15px] font-semibold">{t.demoLead}</h3>
        <button type="button" onClick={() => setLead(emptyLead())} disabled={total === 0} className="site-press inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted hover:text-text disabled:opacity-40">
          <RotateCcw className="size-4" aria-hidden /> {t.demoReset}
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2 sm:grid-cols-4 sm:px-5 sm:pb-5">
        {SHOWN.map((p) => (
          <li key={p} className="rounded-md bg-surface px-2 py-2">
            <span className="block text-center text-[13px] text-muted">{ta.pos[p]}</span>
            <span className="mt-1 flex items-center justify-between">
              <button type="button" aria-label={fmt(t.demoLess, { pos: ta.pos[p] })} onClick={() => bump(p, -STEP)} disabled={lead[p] === 0} className="site-press grid size-9 place-items-center rounded-md text-text hover:bg-surface-2 disabled:opacity-30">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="readout num text-[15px]">
                {fmtNum(lead[p], 1, lang)} {ta.units.g}
              </span>
              <button type="button" aria-label={fmt(t.demoMore, { pos: ta.pos[p] })} onClick={() => bump(p, STEP)} disabled={lead[p] >= MAX} className="site-press grid size-9 place-items-center rounded-md text-text hover:bg-surface-2 disabled:opacity-30">
                <Plus className="size-4" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The racket side on, butt at the left: lead where it sits, the balance
 *  point and the sweet spot, all in centimetres from the butt. */
function RacketDrawing({ lengthCm, headSizeSqIn, lead, balanceCm, baseBalanceCm, sweetSpotCm }: { lengthCm: number; headSizeSqIn: number; lead: LeadMap; balanceCm: number; baseBalanceCm: number; sweetSpotCm: number }) {
  const t = useLanding()
  const g = geometry(lengthCm, headSizeSqIn)
  const at = leadPositions(g)
  const { a, b, xc } = g
  const throatX = xc - 0.75 * a
  const throatY = 0.661 * b
  const top = -b - 3
  const h = 2 * b + 9
  const dot = (grams: number) => 0.9 + Math.sqrt(grams) * 0.55
  const strings = Array.from({ length: 9 }, (_, i) => -b + ((i + 1) * 2 * b) / 10)
  const mains = Array.from({ length: 11 }, (_, i) => xc - a + ((i + 1) * 2 * a) / 12)
  return (
    <svg viewBox={`-1.5 ${top} ${lengthCm + 3} ${h}`} className="mt-3 block h-auto w-full px-2" role="img" aria-label={t.demoDrawing}>
      <defs>
        <clipPath id="site-head">
          <ellipse cx={xc} cy={0} rx={a - 0.5} ry={b - 0.5} />
        </clipPath>
      </defs>
      <g clipPath="url(#site-head)" stroke="var(--c-border-input)" strokeWidth={0.12}>
        {strings.map((y) => (
          <line key={y} x1={xc - a} x2={xc + a} y1={y} y2={y} />
        ))}
        {mains.map((x) => (
          <line key={x} x1={x} x2={x} y1={-b} y2={b} />
        ))}
      </g>
      <g fill="none" stroke="var(--c-text)" strokeWidth={0.9} strokeLinejoin="round">
        <ellipse cx={xc} cy={0} rx={a} ry={b} />
        <path d={`M19.5 -1.25 C 24 -1.25, ${throatX - 4} ${-throatY}, ${throatX} ${-throatY} M19.5 1.25 C 24 1.25, ${throatX - 4} ${throatY}, ${throatX} ${throatY}`} />
      </g>
      <rect x={0} y={-1.5} width={19.5} height={3} rx={0.6} fill="var(--c-surface-2)" stroke="var(--c-text)" strokeWidth={0.5} />
      <g className="site-move" style={{ transform: `translateX(${sweetSpotCm}px)` }}>
        <ellipse cx={0} cy={0} rx={3.6} ry={2.4} fill="var(--c-success)" fillOpacity={0.18} stroke="var(--c-success)" strokeWidth={0.25} strokeDasharray="0.8 0.6" />
        <text x={0} y={b * 0.62} textAnchor="middle" fontSize={2.1} fill="var(--c-text)" stroke="var(--c-bg)" strokeWidth={0.7} paintOrder="stroke">
          {t.demoSweet}
        </text>
      </g>
      {(['tip', 'tenTwo', 'threeNine', 'throat', 'handle'] as Position[]).map((p) => {
        if (lead[p] <= 0) return null
        const { x, y } = at[p]
        const pts = y === 0 ? [0] : [-y, y]
        return pts.map((yy) => <circle key={`${p}${yy}`} cx={x} cy={yy} r={dot(lead[p] / pts.length)} fill="var(--c-accent)" stroke="var(--c-bg)" strokeWidth={0.3} />)
      })}
      <path d={`M${baseBalanceCm} ${b + 1.2} l-1 2 h2 z`} fill="var(--c-border-input)" />
      <g className="site-move" style={{ transform: `translateX(${balanceCm}px)` }}>
        <path d={`M0 ${b + 1.2} l-1.3 2.6 h2.6 z`} fill="var(--c-text)" />
        <text x={1.8} y={b + 3.6} fontSize={2.1} fill="var(--c-text-muted)">
          {t.demoBalance}
        </text>
      </g>
    </svg>
  )
}
