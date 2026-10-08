import { Minus, Plus, X } from 'lucide-react'
import type { Geometry } from '../domain/physics'
import { POSITIONS, type ExtraLead, type LeadMap, type Position } from '../domain/types'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { extraLabel, fmtNum, tapeCm } from '../lib/format'
import { cx } from './basics'

export const LEAD_MAX = 20
const STEP = 0.5

/** Where each position sits on the drawing, in % of its box. Two dots for
 *  positions split across both sides. */
const DOTS: Record<Position, { x: number; y: number }[]> = {
  tip: [{ x: 50, y: 3.5 }],
  tenTwo: [
    { x: 22, y: 13 },
    { x: 78, y: 13 },
  ],
  threeNine: [
    { x: 7, y: 31 },
    { x: 93, y: 31 },
  ],
  throat: [{ x: 50, y: 58 }],
  handle: [{ x: 50, y: 93 }],
}

/** Grams on one dot: 3, 2.5 or 1.25 (half of a split 2.5 g). */
const dotLabel = (g: number, lang: string) =>
  fmtNum(g, Number.isInteger(g) ? 0 : Number.isInteger(g * 2) ? 1 : 2, lang)

/** A plain racket outline, drawn for this app. */
function RacketOutline() {
  return (
    <svg viewBox="0 0 200 420" className="absolute inset-0 size-full" aria-hidden>
      <ellipse cx="100" cy="130" rx="86" ry="118" fill="none" stroke="var(--c-border-input)" strokeWidth="5" />
      <ellipse cx="100" cy="130" rx="80" ry="112" fill="var(--c-surface-2)" opacity=".35" />
      <g stroke="var(--c-border)" strokeWidth="1">
        {[-56, -40, -24, -8, 8, 24, 40, 56].map((dx) => (
          <line key={`v${dx}`} x1={100 + dx} y1={130 - Math.sqrt(1 - (dx / 74) ** 2) * 104} x2={100 + dx} y2={130 + Math.sqrt(1 - (dx / 74) ** 2) * 104} />
        ))}
        {[-80, -60, -40, -20, 0, 20, 40, 60, 80].map((dy) => (
          <line key={`h${dy}`} x1={100 - Math.sqrt(1 - (dy / 106) ** 2) * 72} y1={130 + dy} x2={100 + Math.sqrt(1 - (dy / 106) ** 2) * 72} y2={130 + dy} />
        ))}
      </g>
      <path d="M58 228 Q100 262 100 290 Q100 262 142 228" fill="none" stroke="var(--c-border-input)" strokeWidth="5" strokeLinejoin="round" />
      <rect x="91" y="288" width="18" height="124" rx="5" fill="var(--c-border-input)" opacity=".7" />
      <rect x="88" y="318" width="24" height="94" rx="6" fill="var(--c-surface)" stroke="var(--c-border-input)" strokeWidth="1.5" />
    </svg>
  )
}

/** Vertical position (% of the drawing) for a point x cm from the butt.
 *  The drawing is not to scale, so map piecewise through its landmarks. */
function yPct(x: number, g: Geometry): number {
  const tip = g.L - 1
  if (x >= g.xc) return 31 - ((x - g.xc) / (tip - g.xc)) * (31 - 3.5)
  if (x >= g.xc - g.a) return 31 + ((g.xc - x) / g.a) * (58 - 31)
  return 58 + ((g.xc - g.a - x) / (g.xc - g.a - 6)) * (93 - 58)
}

/** Drawing coordinates (%) of a clock hour on the hoop. */
function hourPct(hour: number) {
  const th = (hour / 12) * 2 * Math.PI
  return { x: ((100 + 86 * Math.sin(th)) / 200) * 100, y: ((130 - 118 * Math.cos(th)) / 420) * 100 }
}

/** Every dot an extra position draws: one, or two mirrored. */
export function extraDots(e: ExtraLead, g?: Geometry): { x: number; y: number }[] {
  if (e.kind === 'shaft') return [{ x: 50, y: g ? Math.min(97, Math.max(2, yPct(e.cm ?? 6, g))) : 80 }]
  const h = e.hour ?? 3
  return e.sides === 2 && h !== 6 ? [hourPct(h), hourPct(12 - h)] : [hourPct(h)]
}

export function RacketDiagram({
  lead,
  selected,
  onSelect,
  sweetSpot,
  extra,
  geometry,
  onSelectExtra,
}: {
  lead: LeadMap
  selected: Position | string
  onSelect: (p: Position) => void
  /** Sweet spot in cm from the butt, with the frame geometry to place it. */
  sweetSpot?: { x: number; g: Geometry }
  extra?: ExtraLead[]
  geometry?: Geometry
  onSelectExtra?: (id: string) => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <div className="relative mx-auto aspect-[200/420] w-full max-w-[180px]">
      <RacketOutline />
      {sweetSpot && (
        <div
          className="pointer-events-none absolute inset-x-[18%] flex -translate-y-1/2 items-center gap-1 transition-[top] duration-200"
          style={{ top: `${Math.min(95, Math.max(2, yPct(sweetSpot.x, sweetSpot.g)))}%` }}
          title={t.spec.sweetSpot}
        >
          <span className="h-px flex-1 bg-success/70" />
          <span className="size-2 rounded-full border-[1.5px] border-success bg-bg" aria-hidden />
          <span className="h-px flex-1 bg-success/70" />
        </div>
      )}
      {POSITIONS.flatMap((p) =>
        DOTS[p].map((d, i) => {
          const g = lead[p]
          const on = g > 0
          return (
            <button
              key={`${p}${i}`}
              type="button"
              onClick={() => onSelect(p)}
              aria-label={`${t.pos[p]}: ${fmtNum(g, 1, lang)} g`}
              aria-pressed={selected === p}
              tabIndex={i === 0 ? 0 : -1}
              className={cx(
                'num absolute flex min-h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-[11px] font-bold transition',
                on ? 'bg-accent text-on-accent' : 'bg-surface text-muted ring-1 ring-border-input',
                selected === p && 'ring-2 ring-text ring-offset-2 ring-offset-bg',
              )}
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
            >
              {on ? dotLabel(DOTS[p].length > 1 ? g / 2 : g, lang) : '+'}
            </button>
          )
        }),
      )}
      {extra?.flatMap((e) =>
        extraDots(e, geometry).map((d, i, all) => (
          <button
            key={`${e.id}${i}`}
            type="button"
            onClick={() => onSelectExtra?.(e.id)}
            aria-label={`${extraLabel(e, t, lang)}: ${fmtNum(e.grams, 1, lang)} g`}
            aria-pressed={selected === e.id}
            tabIndex={i === 0 ? 0 : -1}
            className={cx(
              'num absolute flex min-h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md px-1 text-[10px] font-bold transition',
              e.grams > 0 ? 'bg-bar text-bg' : 'bg-surface text-muted ring-1 ring-dashed ring-border-input',
              selected === e.id && 'ring-2 ring-text ring-offset-2 ring-offset-bg',
            )}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          >
            {e.grams > 0 ? dotLabel(e.grams / all.length, lang) : '+'}
          </button>
        )),
      )}
    </div>
  )
}

/** Slider row for a custom position, with a remove button. */
export function ExtraControl({
  item,
  onChange,
  onRemove,
  selected,
  onFocus,
}: {
  item: ExtraLead
  onChange: (g: number) => void
  onRemove: () => void
  selected?: boolean
  onFocus?: () => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const tape = useStore((s) => s.tapeGPer10cm)
  const name = extraLabel(item, t, lang)
  const split = item.kind === 'hoop' && item.sides === 2 && item.hour !== 6
  const value = item.grams
  const set = (g: number) => onChange(Math.min(LEAD_MAX, Math.max(0, Math.round(g / STEP) * STEP)))
  return (
    <div id={`lead-${item.id}`} className={cx('rounded-md px-3 py-2 transition-colors', selected ? 'bg-surface-2/70' : 'bg-transparent')} onFocusCapture={onFocus}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-medium">
          {name}
          {split && <span className="ml-1.5 text-xs font-normal text-muted">{t.calc.perSide}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="readout whitespace-nowrap text-sm">
            {fmtNum(value, 1, lang)} <span className="font-normal text-muted">g</span>
          </span>
          <button type="button" onClick={onRemove} aria-label={fmt(t.custom.remove, { name })} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-text">
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </div>
      {tape && value > 0 && (
        <p className="num text-xs text-muted">
          {fmt(t.calc.tapeCm, { cm: fmtNum(tapeCm(split ? value / 2 : value, tape), 1, lang) })}
          {split && ' × 2'}
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        <button type="button" aria-label={`− 0,5 g ${name}`} onClick={() => set(value - STEP)} disabled={value <= 0} className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text hover:bg-surface-2 disabled:opacity-30">
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          type="range"
          className="range min-w-0 flex-1"
          min={0}
          max={LEAD_MAX}
          step={STEP}
          value={value}
          aria-label={name}
          aria-valuetext={`${fmtNum(value, 1, lang)} g`}
          style={{ ['--fill' as string]: `${(value / LEAD_MAX) * 100}%` }}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" aria-label={`+ 0,5 g ${name}`} onClick={() => set(value + STEP)} disabled={value >= LEAD_MAX} className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text hover:bg-surface-2 disabled:opacity-30">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function LeadControl({
  position,
  value,
  onChange,
  selected,
  onFocus,
}: {
  position: Position
  value: number
  onChange: (g: number) => void
  selected?: boolean
  onFocus?: () => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const tape = useStore((s) => s.tapeGPer10cm)
  const split = position === 'tenTwo' || position === 'threeNine'
  const set = (g: number) => onChange(Math.min(LEAD_MAX, Math.max(0, Math.round(g / STEP) * STEP)))
  return (
    <div
      id={`lead-${position}`}
      className={cx('rounded-md px-3 py-2 transition-colors', selected ? 'bg-surface-2/70' : 'bg-transparent')}
      onFocusCapture={onFocus}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-medium">
          {t.pos[position]}
          {split && <span className="ml-1.5 text-xs font-normal text-muted">{t.calc.perSide}</span>}
        </span>
        <span className="readout shrink-0 whitespace-nowrap text-sm">
          {fmtNum(value, 1, lang)} <span className="font-normal text-muted">g</span>
        </span>
      </div>
      {tape && value > 0 && (
        <p className="num text-xs text-muted">
          {fmt(t.calc.tapeCm, { cm: fmtNum(tapeCm(split ? value / 2 : value, tape), 1, lang) })}
          {split && ' × 2'}
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={`− 0,5 g ${t.pos[position]}`}
          onClick={() => set(value - STEP)}
          disabled={value <= 0}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text hover:bg-surface-2 disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          type="range"
          className="range min-w-0 flex-1"
          min={0}
          max={LEAD_MAX}
          step={STEP}
          value={value}
          aria-label={t.pos[position]}
          aria-valuetext={`${fmtNum(value, 1, lang)} g`}
          style={{ ['--fill' as string]: `${(value / LEAD_MAX) * 100}%` }}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button
          type="button"
          aria-label={`+ 0,5 g ${t.pos[position]}`}
          onClick={() => set(value + STEP)}
          disabled={value >= LEAD_MAX}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text hover:bg-surface-2 disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
