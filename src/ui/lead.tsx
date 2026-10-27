import type { KeyboardEvent } from 'react'
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

/** Where the lead editor is pointed: a preset position or a custom one's id. */
export type LeadKey = Position | string

/**
 * The lead, edited on the racket itself: tap a spot to pick it, and − and +
 * sit either side of it. Each spot is its position's slider for the keyboard
 * and screen readers (arrows step 0.5 g, Home and End go to 0 and the most).
 * Under the frame, one line: the position, its grams (each side's where the
 * lead is split) and the player's tape to cut. No list of sliders: the page
 * stays short and quiet.
 */
export function LeadEditor({
  lead,
  extra = [],
  selected,
  onSelect,
  onLead,
  onExtra,
  onRemoveExtra,
  sweetSpot,
  geometry,
  pattern,
  frameClassName = 'max-w-[170px]',
}: {
  lead: LeadMap
  extra?: ExtraLead[]
  selected: LeadKey
  onSelect: (k: LeadKey) => void
  onLead: (p: Position, g: number) => void
  onExtra: (id: string, g: number) => void
  onRemoveExtra: (id: string) => void
  sweetSpot?: { x: number; g: Geometry; from?: number }
  geometry?: Geometry
  pattern?: string
  /** The frame's width (the website shows it larger). */
  frameClassName?: string
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const tape = useStore((s) => s.tapeGPer10cm)
  const g = geometry ?? sweetSpot?.g ?? DEFAULT_GEOMETRY
  const f = frameShape(g)
  const pctX = (p: { x: number }) => ((p.x - f.box.x) / f.box.w) * 100
  const pctY = (p: { y: number }) => ((p.y - f.box.y) / f.box.h) * 100
  const ss = sweetSpot ? f.y(sweetSpot.x) : undefined

  // Every spot on the frame: its key, name, grams, and dots (two where split).
  const spots = [
    ...POSITIONS.map((p) => ({
      key: p as LeadKey,
      name: t.pos[p],
      grams: lead[p],
      dots: p === 'handle' ? [{ x: 0, y: f.y(leadPositions(g).handle.x) }] : HOUR[p].map((th) => f.at(th)),
      custom: false,
    })),
    ...extra.map((e) => {
      const th = ((e.hour ?? 3) / 12) * 2 * Math.PI
      const dots = e.kind === 'shaft' ? [{ x: 0, y: f.y(e.cm ?? 6) }] : (e.sides === 2 && e.hour !== 6 ? [th, -th] : [th]).map((a) => f.at(a))
      return { key: e.id as LeadKey, name: extraLabel(e, t, lang), grams: e.grams, dots, custom: true }
    }),
  ]
  const set = (k: LeadKey, grams: number) => {
    const v = Math.min(LEAD_MAX, Math.max(0, Math.round(grams / STEP) * STEP))
    if ((POSITIONS as readonly string[]).includes(k)) onLead(k as Position, v)
    else onExtra(k, v)
  }
  const sel = spots.find((s) => s.key === selected) ?? spots[0]
  const split = sel.dots.length > 1
  // The steppers flank one dot: the right-hand one where the lead is split.
  const anchor = [...sel.dots].sort((a, b) => b.x - a.x)[0]
  const keys = (k: LeadKey, grams: number) => (e: KeyboardEvent) => {
    const by: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 2, PageDown: -2 }
    if (e.key in by) set(k, grams + by[e.key])
    else if (e.key === 'Home') set(k, 0)
    else if (e.key === 'End') set(k, LEAD_MAX)
    else return
    e.preventDefault()
  }

  return (
    <div>
      <div className={cx('relative mx-auto w-full', frameClassName)} style={{ aspectRatio: `${f.box.w} / ${f.box.h}` }}>
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
        {spots.flatMap((s) =>
          s.dots.map((d, i) => {
            const on = s.grams > 0
            const picked = s.key === sel.key
            const first = i === 0
            return (
              <button
                key={`${s.key}${i}`}
                type="button"
                // The first dot is the position's slider; a second one (the
                // other side) only picks it.
                role={first ? 'slider' : undefined}
                aria-label={first ? s.name : undefined}
                aria-hidden={first ? undefined : true}
                aria-valuemin={first ? 0 : undefined}
                aria-valuemax={first ? LEAD_MAX : undefined}
                aria-valuenow={first ? s.grams : undefined}
                aria-valuetext={first ? `${fmtNum(s.grams, 1, lang)} g` : undefined}
                data-lead={first ? s.key : undefined}
                tabIndex={first ? 0 : -1}
                onClick={() => onSelect(s.key)}
                onFocus={() => onSelect(s.key)}
                onKeyDown={keys(s.key, s.grams)}
                className={cx(
                  'num absolute flex min-h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center px-1.5 text-[11px] font-bold shadow-sm transition',
                  s.custom ? 'rounded-md' : 'rounded-full',
                  on ? (s.custom ? 'bg-bar text-bg' : 'bg-accent text-on-accent') : 'bg-surface text-muted ring-1 ring-border-input',
                  picked && 'ring-2 ring-text ring-offset-2 ring-offset-bg',
                )}
                style={{ left: `${pctX(d)}%`, top: `${pctY(d)}%` }}
              >
                {on ? dotLabel(s.grams / s.dots.length, lang) : '+'}
              </button>
            )
          }),
        )}
        {/* − and + either side of the picked spot. */}
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            aria-label={`${dir < 0 ? '−' : '+'} 0,5 g ${sel.name}`}
            onClick={() => set(sel.key, sel.grams + dir * STEP)}
            disabled={dir < 0 ? sel.grams <= 0 : sel.grams >= LEAD_MAX}
            className="absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text shadow-pop hover:bg-surface-2 disabled:opacity-30"
            style={{ left: `calc(${pctX(anchor)}% ${dir < 0 ? '-' : '+'} 2.6rem)`, top: `${pctY(anchor)}%` }}
          >
            {dir < 0 ? <Minus className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          </button>
        ))}
      </div>
      {/* The picked spot, in words. */}
      <p className="num mt-3 flex min-h-9 flex-wrap items-center justify-center gap-x-2 text-sm" aria-live="polite">
        <span className="font-medium">{sel.name}</span>
        <span className="readout">{fmtNum(sel.grams, 1, lang)} g</span>
        {split && sel.grams > 0 && <span className="text-muted">{fmtNum(sel.grams / 2, 2, lang)} g × 2</span>}
        {tape && sel.grams > 0 && (
          <span className="text-muted">
            {fmt(t.calc.tapeCm, { cm: fmtNum(tapeCm(split ? sel.grams / 2 : sel.grams, tape), 1, lang) })}
            {split && ' × 2'}
          </span>
        )}
        {sel.custom && (
          <button type="button" onClick={() => onRemoveExtra(sel.key)} aria-label={fmt(t.custom.remove, { name: sel.name })} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-text">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </p>
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
