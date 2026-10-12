import { Minus, Plus, X } from 'lucide-react'
import { geometry as frameGeometry, leadPositions, type Geometry } from '../domain/physics'
import { POSITIONS, type ExtraLead, type LeadMap, type Position } from '../domain/types'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { extraLabel, fmtNum, tapeCm } from '../lib/format'
import { cx } from './basics'

export const LEAD_MAX = 20
const STEP = 0.5

/** Grams on one dot: 3, 2.5 or 1.25 (half of a split 2.5 g). */
const dotLabel = (g: number, lang: string) =>
  fmtNum(g, Number.isInteger(g) ? 0 : Number.isInteger(g * 2) ? 1 : 2, lang)

const DEFAULT_GEOMETRY = frameGeometry(68.58, 100)
/** Where the throat's V closes, just above the handle, and where the handle
 *  starts (cm from the butt). */
const THROAT_APEX = 21.5
const HANDLE_TOP = 19.5
const BEAM = 1.15

/** The frame drawn to scale, in cm: x across (0 = centre line), y down from
 *  the tip. Lead positions then land where the physics puts them. */
function frameShape(g: Geometry) {
  const yc = g.L - g.xc
  const at = (th: number, grow = 0) => ({ x: (g.b + grow) * Math.sin(th), y: yc - (g.a + grow) * Math.cos(th) })
  const y = (xFromButt: number) => g.L - xFromButt
  const pad = 1.6
  const box = { x: -(g.b + pad), y: -0.8, w: 2 * (g.b + pad), h: g.L + 1.6 }
  return { yc, at, y, box }
}

/** An arc along the hoop's centre line, centred on angle th, len cm long. */
function hoopArc(f: ReturnType<typeof frameShape>, g: Geometry, th: number, len: number, grow = 0) {
  const half = len / 2 / ((g.a + g.b) / 2)
  const pts: string[] = []
  for (let i = 0; i <= 16; i++) {
    const p = f.at(th - half + (2 * half * i) / 16, grow)
    pts.push(`${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
  }
  return `M${pts.join('L')}`
}

const HOUR: Record<Exclude<Position, 'handle'>, number[]> = {
  tip: [0],
  tenTwo: [-Math.PI / 3, Math.PI / 3],
  threeNine: [-Math.PI / 2, Math.PI / 2],
  throat: [Math.PI],
}

function RacketArt({ g, pattern }: { g: Geometry; pattern?: string }) {
  const f = frameShape(g)
  const [mains, crosses] = (pattern?.match(/^(\d+)\s*x\s*(\d+)/i)?.slice(1).map(Number) ?? [16, 19]) as [number, number]
  const bedX = g.b - BEAM / 2 - 0.15
  const bedY = g.a - BEAM / 2 - 0.15
  const yS = f.y(THROAT_APEX)
  const yH = f.y(HANDLE_TOP)
  // The throat: a narrow V from just above the handle, opening until it meets
  // the hoop near 5 and 7 o'clock, where the hoop turns in to the yoke.
  const th = (146 / 180) * Math.PI
  const r = f.at(th)
  const l = f.at(-th)
  const frame = 'var(--c-text)'
  return (
    <>
      <defs>
        <clipPath id="bed">
          <ellipse cx="0" cy={f.yc} rx={bedX} ry={bedY} />
        </clipPath>
        <clipPath id="grip">
          <rect x="-1.4" y={yH + 0.45} width="2.8" height={g.L - yH - 1.15} rx="0.3" />
        </clipPath>
      </defs>
      {/* String bed */}
      <ellipse cx="0" cy={f.yc} rx={bedX} ry={bedY} fill="var(--c-surface)" />
      <g clipPath="url(#bed)" stroke="var(--c-border-input)" strokeWidth="0.08" opacity="0.5">
        {Array.from({ length: mains }, (_, i) => {
          const x = -bedX * 0.9 + ((i + 0.5) * (2 * bedX * 0.9)) / mains
          return <line key={`m${i}`} x1={x} y1={f.yc - g.a} x2={x} y2={f.yc + g.a} />
        })}
        {Array.from({ length: crosses }, (_, i) => {
          const y = f.yc - bedY * 0.94 + ((i + 0.5) * (2 * bedY * 0.94)) / crosses
          return <line key={`c${i}`} x1={-g.b} y1={y} x2={g.b} y2={y} />
        })}
      </g>
      {/* Bumper guard over the top of the hoop */}
      <path d={hoopArc(f, g, 0, 17, BEAM / 2 + 0.2)} fill="none" stroke="var(--c-text-muted)" strokeWidth="0.45" strokeLinecap="round" opacity="0.55" />
      {/* Hoop (its bottom is the yoke), throat arms and shaft */}
      <ellipse cx="0" cy={f.yc} rx={g.b} ry={g.a} fill="none" stroke={frame} strokeWidth={BEAM} />
      <path d={`M${r.x} ${r.y} L0 ${yS} L${l.x} ${l.y}`} fill="none" stroke={frame} strokeWidth={BEAM} strokeLinejoin="round" />
      <path d={`M-0.55 ${yS - 0.3} L0.55 ${yS - 0.3} L0.8 ${yH + 0.2} L-0.8 ${yH + 0.2} Z`} fill={frame} />
      {/* Handle: a dark grip wrapped in overlapping turns, a collar and the butt cap */}
      <rect x="-1.4" y={yH + 0.45} width="2.8" height={g.L - yH - 1.15} rx="0.3" fill={frame} opacity="0.88" />
      <g clipPath="url(#grip)" stroke="var(--c-bg)" strokeWidth="0.09" opacity="0.35">
        {Array.from({ length: Math.ceil((g.L - yH) / 1.1) + 2 }, (_, i) => {
          const y0 = yH + 0.3 + i * 1.1
          return <line key={i} x1="-1.5" y1={y0} x2="1.5" y2={y0 - 1} />
        })}
      </g>
      <rect x="-1.25" y={yH} width="2.5" height="0.5" rx="0.2" fill="var(--c-text-muted)" />
      <rect x="-1.55" y={g.L - 0.75} width="3.1" height="0.75" rx="0.3" fill={frame} />
    </>
  )
}

export function RacketDiagram({
  lead,
  selected,
  onSelect,
  sweetSpot,
  extra,
  geometry,
  pattern,
  onSelectExtra,
}: {
  lead: LeadMap
  selected: Position | string
  onSelect: (p: Position) => void
  /** Sweet spot in cm from the butt, with the frame geometry to place it;
   *  `from` is where it was without lead, drawn as an outline. */
  sweetSpot?: { x: number; g: Geometry; from?: number }
  extra?: ExtraLead[]
  geometry?: Geometry
  /** String pattern, e.g. "16x19", for the string bed. */
  pattern?: string
  onSelectExtra?: (id: string) => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const g = geometry ?? sweetSpot?.g ?? DEFAULT_GEOMETRY
  const f = frameShape(g)
  const pct = (p: { x: number; y: number }) => ({ left: `${((p.x - f.box.x) / f.box.w) * 100}%`, top: `${((p.y - f.box.y) / f.box.h) * 100}%` })
  // Where each preset sits: on the frame, one dot per side for split ones.
  const spots = (p: Position) => (p === 'handle' ? [{ x: 0, y: f.y(leadPositions(g).handle.x) }] : HOUR[p].map((th) => f.at(th)))
  const extraSpots = (e: ExtraLead) => {
    if (e.kind === 'shaft') return [{ x: 0, y: f.y(e.cm ?? 6) }]
    const th = ((e.hour ?? 3) / 12) * 2 * Math.PI
    return (e.sides === 2 && e.hour !== 6 ? [th, -th] : [th]).map((a) => f.at(a))
  }
  const ss = sweetSpot ? f.y(sweetSpot.x) : undefined

  return (
    <div className="relative mx-auto w-full max-w-[150px] @lg:max-w-[170px]" style={{ aspectRatio: `${f.box.w} / ${f.box.h}` }}>
      <svg viewBox={`${f.box.x} ${f.box.y} ${f.box.w} ${f.box.h}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <RacketArt g={g} pattern={pattern} />
        {sweetSpot?.from !== undefined && Math.abs(sweetSpot.from - sweetSpot.x) >= 0.05 && (
          <ellipse cx="0" cy={f.y(sweetSpot.from)} rx={g.b * 0.42} ry={g.a * 0.2} fill="none" stroke="var(--c-success)" strokeWidth="0.15" strokeDasharray="0.5 0.4" opacity="0.8" />
        )}
        {ss !== undefined && (
          <g style={{ transform: `translateY(${ss}px)`, transition: 'transform 200ms ease-out' }}>
            <ellipse cx="0" cy="0" rx={g.b * 0.42} ry={g.a * 0.2} fill="var(--c-success)" opacity="0.2" />
            <circle cx="0" cy="0" r="0.45" fill="var(--c-success)" />
          </g>
        )}
      </svg>
      {POSITIONS.flatMap((p) => {
        const each = spots(p)
        const g8 = lead[p]
        const on = g8 > 0
        return each.map((d, i) => (
          <button
            key={`${p}${i}`}
            type="button"
            onClick={() => onSelect(p)}
            aria-label={`${t.pos[p]}: ${fmtNum(g8, 1, lang)} g`}
            aria-pressed={selected === p}
            tabIndex={i === 0 ? 0 : -1}
            className={cx(
              'num absolute flex min-h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-[11px] font-bold transition',
              on ? 'bg-accent text-on-accent' : 'bg-surface text-muted ring-1 ring-border-input',
              selected === p && 'ring-2 ring-text ring-offset-2 ring-offset-bg',
            )}
            style={pct(d)}
          >
            {on ? dotLabel(g8 / each.length, lang) : '+'}
          </button>
        ))
      })}
      {extra?.flatMap((e) => {
        const each = extraSpots(e)
        return each.map((d, i) => (
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
            style={pct(d)}
          >
            {e.grams > 0 ? dotLabel(e.grams / each.length, lang) : '+'}
          </button>
        ))
      })}
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
