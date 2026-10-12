import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { mapLayout, type MapPoint } from '../domain/racketMap'
import type { Racket } from '../domain/types'
import { useT } from '../i18n'
import { brandMark } from './brands'
import { cx } from './basics'

const C = 200
const R = 160
const at = (p: MapPoint) => ({ x: C + p.x * R, y: C - p.y * R })

/** Each half-axis wears the colour of what it stands for. */
const AXIS = { spin: 'var(--c-spin)', power: 'var(--c-power)', control: 'var(--c-control)', touch: 'var(--c-comfort)' }

/** A brand's badge: its colour and initials, for the map and the lists. */
function Badge({ brand, size = 18 }: { brand: string; size?: number }) {
  const b = brandMark(brand)
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none"
      style={{ background: b.color, color: b.ink, width: size, height: size, fontSize: size * (b.initials.length > 1 ? 0.42 : 0.5) }}
    >
      {b.initials}
    </span>
  )
}

/**
 * Every frame of the library as a dot in its brand's colour, and the picked
 * ones as badges with their names: control to power across, touch to spin
 * up and down. Tap a brand below to bring its frames forward.
 */
export function RacketMap({ all, picked, onRemove }: { all: Racket[]; picked: Racket[]; onRemove: (id: string) => void }) {
  const t = useT()
  const m = t.library.map
  const [focus, setFocus] = useState<string | null>(null)
  const stock = useMemo(() => all.filter((r) => r.isStock), [all])
  const place = useMemo(() => mapLayout(stock), [stock])
  const cloud = useMemo(() => stock.map((r) => ({ r, ...at(place(r)) })), [stock, place])
  const brands = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of stock) n.set(r.brand, (n.get(r.brand) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1])
  }, [stock])

  // Labels: right of the badge (left near the right edge), moved down when
  // they would sit on another label, a badge or the centre's name; a line
  // then ties each one to its badge.
  const marks = useMemo(() => {
    const dots = picked.map((r) => ({ r, ...at(place(r)) }))
    const placed: { x: number; y: number; w: number }[] = [{ x: C - 34, y: C + 50, w: 68 }, ...dots.map((d) => ({ x: d.x - 10, y: d.y + 4, w: 20 }))]
    return dots
      .sort((a, b) => a.y - b.y)
      .map((d) => {
        const text = `${d.r.model}${d.r.year ? ` ${d.r.year}` : ''}`
        const w = Math.min(150, text.length * 6.2)
        let lx = d.x + 13
        if (lx + w > 396) lx = d.x - 13 - w
        let ly = d.y + 4
        const own = (p: { x: number; y: number }) => p.x === d.x - 10 && p.y === d.y + 4
        while (placed.some((p) => !own(p) && Math.abs(p.y - ly) < 13 && lx < p.x + p.w && lx + w > p.x)) ly += 13
        placed.push({ x: lx, y: ly, w })
        return { ...d, text, lx, ly, w, moved: Math.abs(ly - (d.y + 4)) > 1, mark: brandMark(d.r.brand) }
      })
  }, [picked, place])

  const corners = [
    { x: 8, y: 22, anchor: 'start', name: m.zones.spinControl },
    { x: 392, y: 22, anchor: 'end', name: m.zones.spinPower },
    { x: 8, y: 388, anchor: 'start', name: m.zones.touchControl },
    { x: 392, y: 388, anchor: 'end', name: m.zones.touchPower },
  ] as const
  // Each quadrant is tinted with the two axes it sits between.
  const quads = [
    { id: 'q-sc', x: C - R, y: C - R, a: AXIS.spin, b: AXIS.control, x1: 1, y1: 0, x2: 0, y2: 1 },
    { id: 'q-sp', x: C, y: C - R, a: AXIS.spin, b: AXIS.power, x1: 0, y1: 0, x2: 1, y2: 1 },
    { id: 'q-tc', x: C - R, y: C, a: AXIS.control, b: AXIS.touch, x1: 0, y1: 0, x2: 1, y2: 1 },
    { id: 'q-tp', x: C, y: C, a: AXIS.power, b: AXIS.touch, x1: 1, y1: 0, x2: 0, y2: 1 },
  ]

  return (
    <div>
      <svg viewBox="0 0 400 400" className="mx-auto block w-full max-w-[460px]" role="img" aria-label={`${m.title}: ${picked.map((r) => `${r.brand} ${r.model}`).join(', ') || m.empty}`}>
        <defs>
          <clipPath id="map-disc">
            <circle cx={C} cy={C} r={R} />
          </clipPath>
          {quads.map((q) => (
            <linearGradient key={q.id} id={q.id} x1={q.x1} y1={q.y1} x2={q.x2} y2={q.y2}>
              <stop offset="0" stopColor={q.a} stopOpacity="0.2" />
              <stop offset="1" stopColor={q.b} stopOpacity="0.2" />
            </linearGradient>
          ))}
        </defs>
        <g clipPath="url(#map-disc)">
          {quads.map((q) => (
            <rect key={q.id} x={q.x} y={q.y} width={R} height={R} fill={`url(#${q.id})`} />
          ))}
        </g>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--c-border-input)" strokeDasharray="5 6" />
        {/* Axes: each half in its colour */}
        <g strokeWidth="2" strokeLinecap="round" opacity="0.85">
          <line x1={C} y1={C} x2={C} y2={C - R - 6} stroke={AXIS.spin} />
          <line x1={C} y1={C} x2={C} y2={C + R + 6} stroke={AXIS.touch} />
          <line x1={C} y1={C} x2={C - R - 6} y2={C} stroke={AXIS.control} />
          <line x1={C} y1={C} x2={C + R + 6} y2={C} stroke={AXIS.power} />
        </g>
        <circle cx={C} cy={C} r="34" fill="var(--c-bg)" fillOpacity="0.55" stroke="var(--c-text-muted)" strokeDasharray="3 4" />
        <text x={C} y={C + 50} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--c-text-muted)">
          {m.zones.allround}
        </text>
        <g fontSize="11" fontWeight="600" fill="var(--c-text-muted)">
          {corners.map((z) => (
            <text key={z.name} x={z.x} y={z.y} textAnchor={z.anchor}>
              {z.name}
            </text>
          ))}
        </g>
        <g fontSize="11" fontWeight="700" letterSpacing="1.5" fill="var(--c-text)" textAnchor="middle">
          <text x={C} y={C - R - 14}>{m.axes.spin.toUpperCase()}</text>
          <text x={C} y={C + R + 24}>{m.axes.touch.toUpperCase()}</text>
          <text transform={`translate(${C - R - 16} ${C}) rotate(-90)`}>{m.axes.control.toUpperCase()}</text>
          <text transform={`translate(${C + R + 16} ${C}) rotate(90)`}>{m.axes.power.toUpperCase()}</text>
        </g>

        {cloud.map((p) => {
          const on = !focus || p.r.brand === focus
          return (
            <circle key={p.r.id} cx={p.x} cy={p.y} r={focus && on ? 4 : 3} fill={brandMark(p.r.brand).color} opacity={on ? (focus ? 0.95 : 0.6) : 0.12}>
              <title>{`${p.r.brand} ${p.r.model}${p.r.year ? ` ${p.r.year}` : ''}`}</title>
            </circle>
          )
        })}
        {marks.map((d) => (
          <g key={d.r.id}>
            {d.moved && <line x1={d.x} y1={d.y} x2={d.lx < d.x ? d.lx + d.w + 2 : d.lx - 2} y2={d.ly - 4} stroke={d.mark.color} strokeWidth="1.2" />}
            <circle cx={d.x} cy={d.y} r="9.5" fill={d.mark.color} stroke="var(--c-bg)" strokeWidth="1.8" />
            <text x={d.x} y={d.y + 3.3} textAnchor="middle" fontSize={d.mark.initials.length > 1 ? 8 : 9.5} fontWeight="700" fill={d.mark.ink}>
              {d.mark.initials}
            </text>
            <text x={d.lx} y={d.ly} fontSize="11" fontWeight="600" fill="var(--c-text)" stroke="var(--c-bg)" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
              {d.text}
            </text>
          </g>
        ))}
      </svg>

      {/* Brands: tap one to bring its frames forward. */}
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={m.brands}>
        {brands.map(([b, n]) => (
          <li key={b}>
            <button
              type="button"
              aria-pressed={focus === b}
              onClick={() => setFocus(focus === b ? null : b)}
              className={cx(
                'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs transition-colors',
                focus === b ? 'border-text bg-surface-2 font-semibold' : 'border-border text-muted hover:text-text',
              )}
            >
              <Badge brand={b} />
              {b}
              <span className="num">{n}</span>
            </button>
          </li>
        ))}
      </ul>

      {picked.length === 0 ? (
        <p className="mt-3 text-center text-sm text-muted">{m.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={m.title}>
          {picked.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-1 pr-0.5 text-sm">
              <Badge brand={r.brand} size={20} />
              <span className="text-muted">{r.brand}</span> {r.model}
              <button type="button" onClick={() => onRemove(r.id)} aria-label={`${m.remove}: ${r.brand} ${r.model}`} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-text">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
