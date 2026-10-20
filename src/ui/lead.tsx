import { Minus, Plus, X } from 'lucide-react'
import { geometry as frameGeometry, leadPositions, type Geometry } from '../domain/physics'
import type { Strip } from '../domain/preview'
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

/** Where the handle starts and the throat's opening ends (cm from the butt). */
const HANDLE_TOP = 19.5
const THROAT_END = 23
const BEAM = 1.15
/** Half the handle's width, and how far the butt cap flares past it. */
const GRIP = 1.45
const FLARE = 0.4

const f2 = (n: number) => n.toFixed(2)
const pt = (p: { x: number; y: number }) => `${f2(p.x)} ${f2(p.y)}`
const unit = (x: number, y: number) => {
  const l = Math.hypot(x, y) || 1
  return { x: x / l, y: y / l }
}

/**
 * The frame as one piece, from standard proportions (head about half the
 * length, throat a quarter, handle a quarter): an outer outline shaped like a
 * drop, where the hoop flows into the throat's arms and the arms into the
 * handle, with two openings cut out: the string bed, and the throat under
 * the yoke. Sized from this frame's length and head, so lead lands where the
 * physics puts it.
 */
function frameOutline(g: Geometry) {
  const f = frameShape(g)
  const w = BEAM / 2
  const yH = f.y(HANDLE_TOP)
  const yT = f.y(THROAT_END)
  const yB = g.L

  // Outside: round the head, leave the hoop at about 4 and 8 o'clock along
  // its curve, and sweep into the handle.
  const rx = g.b + w
  const ry = g.a + w
  const th0 = (124 / 180) * Math.PI
  const top = { x: 0, y: f.yc - ry }
  const side = (s: 1 | -1) => {
    const p = f.at(s * th0, w)
    const d = unit(s * rx * Math.cos(th0), ry * Math.sin(th0))
    const c1 = { x: p.x + d.x * 6, y: p.y + d.y * 6 }
    const c2 = { x: s * (GRIP + 0.25), y: yH - 6.5 }
    return { p, c1, c2, end: { x: s * GRIP, y: yH } }
  }
  const r = side(1)
  const l = side(-1)
  const butt = (s: 1 | -1) => [
    { x: s * GRIP, y: yB - 1.4 },
    { x: s * GRIP, y: yB - 0.7 },
    { x: s * (GRIP + FLARE), y: yB - 0.6 },
    { x: s * (GRIP + FLARE), y: yB - 0.25 },
  ]
  const br = butt(1)
  const bl = butt(-1)
  const outside = [
    `M${pt(top)}`,
    `A${f2(rx)} ${f2(ry)} 0 0 1 ${pt(r.p)}`,
    `C${pt(r.c1)} ${pt(r.c2)} ${pt(r.end)}`,
    `L${pt(br[0])}`,
    `C${pt(br[1])} ${pt(br[2])} ${pt(br[3])}`,
    `Q${f2(GRIP + FLARE)} ${f2(yB)} ${f2(GRIP)} ${f2(yB)}`,
    `L${f2(-GRIP)} ${f2(yB)}`,
    `Q${f2(-GRIP - FLARE)} ${f2(yB)} ${pt(bl[3])}`,
    `C${pt(bl[2])} ${pt(bl[1])} ${pt(bl[0])}`,
    `L${pt(l.end)}`,
    `C${pt(l.c2)} ${pt(l.c1)} ${pt(l.p)}`,
    `A${f2(rx)} ${f2(ry)} 0 0 1 ${pt(top)}`,
    'Z',
  ].join(' ')

  // The string bed.
  const bx = g.b - w
  const by = g.a - w
  const bed = `M0 ${f2(f.yc - by)} A${f2(bx)} ${f2(by)} 0 1 1 0 ${f2(f.yc + by)} A${f2(bx)} ${f2(by)} 0 1 1 0 ${f2(f.yc - by)} Z`

  // The throat's opening: its top follows the yoke (a bar about as thick as
  // the hoop, under the bed), its sides run alongside the arms, its corners
  // and tip are rounded, the tip just above the handle.
  const yoke = 0.45
  const phi = (23 / 180) * Math.PI
  const at = (a: number) => f.at(a, w + yoke)
  const cr = at(Math.PI - phi)
  const cl = at(Math.PI + phi)
  const ar = at(Math.PI - phi + 0.07)
  const al = at(Math.PI + phi - 0.07)
  const dr = { x: cr.x - 0.6, y: cr.y + 1.25 }
  const dl = { x: cl.x + 0.6, y: cl.y + 1.25 }
  // Corner controls pulled in, so the corners round off instead of peaking.
  const kr = { x: cr.x - 0.2, y: cr.y + 0.35 }
  const kl = { x: cl.x + 0.2, y: cl.y + 0.35 }
  const orx = g.b + w + yoke
  const ory = g.a + w + yoke
  const throat = [
    `M${pt(ar)}`,
    `A${f2(orx)} ${f2(ory)} 0 0 1 ${pt(al)}`,
    `Q${pt(kl)} ${pt(dl)}`,
    `C${f2(dl.x + 1.6)} ${f2(dl.y + 4)} ${f2(-1.1)} ${f2(yT - 3.4)} ${f2(-0.5)} ${f2(yT - 0.6)}`,
    `Q0 ${f2(yT + 0.15)} 0.5 ${f2(yT - 0.6)}`,
    `C1.1 ${f2(yT - 3.4)} ${f2(dr.x - 1.6)} ${f2(dr.y + 4)} ${pt(dr)}`,
    `Q${pt(kr)} ${pt(ar)}`,
    'Z',
  ].join(' ')

  return { outside, bed, throat, yH, bx, by, yc: f.yc }
}

function RacketArt({ g, pattern }: { g: Geometry; pattern?: string }) {
  const f = frameShape(g)
  const o = frameOutline(g)
  const [mains, crosses] = (pattern?.match(/^(\d+)\s*x\s*(\d+)/i)?.slice(1).map(Number) ?? [16, 19]) as [number, number]
  const frame = 'var(--c-text)'
  return (
    <>
      <defs>
        <clipPath id="bed">
          <path d={o.bed} />
        </clipPath>
        <clipPath id="grip">
          <rect x={-GRIP} y={o.yH} width={GRIP * 2} height={g.L - o.yH - 1.3} />
        </clipPath>
      </defs>
      {/* String bed */}
      <path d={o.bed} fill="var(--c-surface)" />
      <g clipPath="url(#bed)" stroke="var(--c-border-input)" strokeWidth="0.08" opacity="0.55">
        {Array.from({ length: mains }, (_, i) => {
          const x = -o.bx * 0.92 + ((i + 0.5) * (2 * o.bx * 0.92)) / mains
          return <line key={`m${i}`} x1={x} y1={o.yc - g.a} x2={x} y2={o.yc + g.a} />
        })}
        {Array.from({ length: crosses }, (_, i) => {
          const y = o.yc - o.by * 0.95 + ((i + 0.5) * (2 * o.by * 0.95)) / crosses
          return <line key={`c${i}`} x1={-g.b} y1={y} x2={g.b} y2={y} />
        })}
      </g>
      {/* The frame: one piece, the bed and the throat cut out */}
      <path d={`${o.outside} ${o.bed} ${o.throat}`} fill={frame} fillRule="evenodd" />
      {/* Bumper guard along the top */}
      <path d={hoopArc(f, g, 0, 17, 0)} fill="none" stroke="var(--c-text-muted)" strokeWidth="0.35" strokeLinecap="round" opacity="0.6" />
      {/* Grip: wrapped turns over the handle, a collar where it starts */}
      <g clipPath="url(#grip)" stroke="var(--c-bg)" strokeWidth="0.09" opacity="0.3">
        {Array.from({ length: Math.ceil((g.L - o.yH) / 1.1) + 2 }, (_, i) => {
          const y0 = o.yH + 0.4 + i * 1.1
          return <line key={i} x1={-GRIP - 0.2} y1={y0} x2={GRIP + 0.2} y2={y0 - 1} />
        })}
      </g>
      <line x1={-GRIP} y1={o.yH + 0.25} x2={GRIP} y2={o.yH + 0.25} stroke="var(--c-text-muted)" strokeWidth="0.3" />
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
              'num absolute flex min-h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-[11px] font-bold shadow-sm transition',
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

/**
 * The paywall's racket: the frame and the strips of lead a plan puts on,
 * the first `shown` of them. No grams and nothing to press: the strips only
 * say how far the player's racket is from the target.
 */
export function StripDiagram({ geometry: g, pattern, strips, shown }: { geometry: Geometry; pattern?: string; strips: Strip[]; shown: number }) {
  const f = frameShape(g)
  const handle = f.y(leadPositions(g).handle.x)
  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${f.box.w} / ${f.box.h}` }}>
      <svg viewBox={`${f.box.x} ${f.box.y} ${f.box.w} ${f.box.h}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <RacketArt g={g} pattern={pattern} />
        {strips.slice(0, shown).map((s, i) =>
          s.position === 'handle' ? (
            <line key={i} x1={-GRIP} x2={GRIP} y1={handle - s.layer * 0.6} y2={handle - s.layer * 0.6} stroke="var(--c-accent)" strokeWidth="0.4" strokeLinecap="round" />
          ) : (
            // Inside the hoop, each strip a little further in than the last.
            <path key={i} d={hoopArc(f, g, HOUR[s.position][s.side], 3, -(0.55 + s.layer * 0.4))} fill="none" stroke="var(--c-accent)" strokeWidth="0.32" strokeLinecap="round" />
          ),
        )}
      </svg>
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
