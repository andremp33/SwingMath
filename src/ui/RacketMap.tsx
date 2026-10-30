import { X } from 'lucide-react'
import { useMemo } from 'react'
import { mapLayout, type MapPoint } from '../domain/racketMap'
import type { Racket } from '../domain/types'
import { OnceHint } from './hint'
import { useT } from '../i18n'

/** The map is a square: four tiles, one per zone, around a centre. */
const W = 400
const C = 200
/** From the centre to an edge of the square. */
const P = 172
const GAP = 3
const RADIUS = 14
const at = (p: MapPoint) => ({ x: C + p.x * P, y: C - p.y * P })

type Zone = 'spinControl' | 'spinPower' | 'touchControl' | 'touchPower' | 'allround'
/** One strong colour per zone (darker in the light theme, for contrast). */
const ZONE_COLOR: Record<Zone, string> = {
  spinControl: 'var(--zone-sc)',
  spinPower: 'var(--zone-sp)',
  touchControl: 'var(--zone-tc)',
  touchPower: 'var(--zone-tp)',
  allround: 'var(--c-text)',
}

/** Half the side of the all-round square in the middle. */
const MID = 30

/** The zone a point falls in: the middle square, or its quadrant. */
function zoneOf(p: MapPoint): Zone {
  if (Math.abs(p.x) * P < MID && Math.abs(p.y) * P < MID) return 'allround'
  return p.y >= 0 ? (p.x < 0 ? 'spinControl' : 'spinPower') : p.x < 0 ? 'touchControl' : 'touchPower'
}

/** A tile: square at the centre, rounded at the square's outer corner.
 *  sx, sy: which way it points. */
function tile(sx: 1 | -1, sy: 1 | -1) {
  const x0 = C + sx * GAP
  const y0 = C + sy * GAP
  const x1 = C + sx * P
  const y1 = C + sy * P
  return `M${x0} ${y0} L${x1} ${y0} L${x1} ${y1 - sy * RADIUS} Q${x1} ${y1} ${x1 - sx * RADIUS} ${y1} L${x0} ${y1} Z`
}

/** The outer edge of a tile: the two sides that make the square's border. */
function rim(sx: 1 | -1, sy: 1 | -1) {
  const x0 = C + sx * (GAP + 10)
  const y0 = C + sy * (GAP + 10)
  const x1 = C + sx * P
  const y1 = C + sy * P
  return `M${x1} ${y0} L${x1} ${y1 - sy * RADIUS} Q${x1} ${y1} ${x1 - sx * RADIUS} ${y1} L${x0} ${y1}`
}

// Zone names sit outside the square, at its corners, beside the axis names.
const TILES = [
  { zone: 'spinControl', sx: -1, sy: -1, anchor: 'start' },
  { zone: 'spinPower', sx: 1, sy: -1, anchor: 'end' },
  { zone: 'touchControl', sx: -1, sy: 1, anchor: 'start' },
  { zone: 'touchPower', sx: 1, sy: 1, anchor: 'end' },
] as const
const nameAt = (sx: 1 | -1, sy: 1 | -1) => ({ x: C + sx * P, y: sy < 0 ? C - P - 9 : C + P + 19 })

/**
 * Every frame of the library as a faint dot, and the picked ones as diamonds
 * in the colour of their zone, with their names: control to power across,
 * touch to spin up and down.
 */
export function RacketMap({ all, picked, onRemove }: { all: Racket[]; picked: Racket[]; onRemove: (id: string) => void }) {
  const t = useT()
  const m = t.library.map
  const stock = useMemo(() => all.filter((r) => r.isStock), [all])
  const place = useMemo(() => mapLayout(stock), [stock])
  const cloud = useMemo(() => stock.map((r) => ({ id: r.id, ...at(place(r)) })), [stock, place])

  // Each name tries the sides of its diamond in turn, then further up or
  // down, keeping off the centre, the other diamonds and the square's edge;
  // a thin line ties it back when it had to move.
  const marks = useMemo(() => {
    const dots = picked.map((r) => {
      const p = place(r)
      return { r, color: ZONE_COLOR[zoneOf(p)], ...at(p) }
    })
    const taken = [
      { x: C - MID, y: C - MID, w: MID * 2, h: MID * 2 + 16 },
      ...dots.map((d) => ({ x: d.x - 6, y: d.y - 6, w: 12, h: 12 })),
    ]
    const hits = (b: { x: number; y: number; w: number; h: number }, own: { x: number; y: number }) =>
      b.x < C - P + 4 ||
      b.x + b.w > C + P - 4 ||
      b.y < C - P + 2 ||
      b.y + b.h > C + P - 2 ||
      taken.some((o) => !(o.x === own.x - 6 && o.y === own.y - 6) && b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)
    return dots
      .sort((a, b) => a.y - b.y)
      .map((d) => {
        const text = `${d.r.model}${d.r.year ? ` ’${String(d.r.year).slice(-2)}` : ''}`
        const w = text.length * 6
        const h = 12
        const tries: [number, number][] = [[d.x + 10, d.y - 6], [d.x - 10 - w, d.y - 6]]
        for (let k = 1; k <= 7; k++) for (const dy of [-13 * k, 13 * k]) tries.push([d.x + 10, d.y - 6 + dy], [d.x - 10 - w, d.y - 6 + dy])
        const [lx, ty] = tries.find(([x, y]) => !hits({ x, y, w, h }, d)) ?? tries[0]
        taken.push({ x: lx, y: ty, w, h })
        return { ...d, text, lx, ly: ty + 9.5, w, moved: Math.abs(ty - (d.y - 6)) > 1 }
      })
  }, [picked, place])

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto block w-full max-w-115" role="img" aria-label={`${m.title}: ${picked.map((r) => `${r.brand} ${r.model}`).join(', ') || m.empty}`}>
        {/* Four tiles, each faintly in its zone's colour, its outer edge in full */}
        {TILES.map((tl) => (
          <g key={tl.zone}>
            <path d={tile(tl.sx, tl.sy)} fill={ZONE_COLOR[tl.zone]} fillOpacity="0.1" />
            <path d={rim(tl.sx, tl.sy)} fill="none" stroke={ZONE_COLOR[tl.zone]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text {...nameAt(tl.sx, tl.sy)} textAnchor={tl.anchor} fontSize="11.5" fontWeight="700" fill={ZONE_COLOR[tl.zone]}>
              {m.zones[tl.zone]}
            </text>
          </g>
        ))}
        {/* The centre: all-round */}
        <rect x={C - MID} y={C - MID} width={MID * 2} height={MID * 2} rx="8" fill="var(--c-bg)" fillOpacity="0.7" stroke="var(--c-text-muted)" strokeDasharray="3 4" />
        <text x={C} y={C + MID + 13} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--c-text-muted)">
          {m.zones.allround}
        </text>
        {/* Axis names outside the square */}
        <g fontSize="11" fontWeight="700" letterSpacing="1.5" fill="var(--c-text)" textAnchor="middle">
          <text x={C} y={C - P - 9}>{m.axes.spin.toUpperCase()}</text>
          <text x={C} y={C + P + 19}>{m.axes.touch.toUpperCase()}</text>
          <text transform={`translate(${C - P - 9} ${C}) rotate(-90)`}>{m.axes.control.toUpperCase()}</text>
          <text transform={`translate(${C + P + 9} ${C}) rotate(90)`}>{m.axes.power.toUpperCase()}</text>
        </g>

        {cloud.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r="2.2" fill="var(--c-text-muted)" opacity="0.35" />
        ))}
        {marks.map((d) => (
          <g key={d.r.id}>
            {d.moved && <line x1={d.x} y1={d.y} x2={d.lx < d.x ? d.lx + d.w + 1 : d.lx - 1} y2={d.ly - 4} stroke={d.color} strokeWidth="1.1" />}
            <rect x={d.x - 5.5} y={d.y - 5.5} width="11" height="11" transform={`rotate(45 ${d.x} ${d.y})`} fill={d.color} stroke="var(--c-bg)" strokeWidth="1.5" />
            <text x={d.lx} y={d.ly} fontSize="11" fontWeight="700" fill={d.color} stroke="var(--c-bg)" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
              {d.text}
            </text>
          </g>
        ))}
      </svg>

      {/* How to fill it, until the first racket goes on. */}
      <OnceHint id="map" done={picked.length > 0} className="mt-2 justify-center">
        {m.empty}
      </OnceHint>
      {picked.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={m.title}>
          {picked.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-0.5 text-sm">
              <span aria-hidden className="size-2.5 rotate-45" style={{ background: ZONE_COLOR[zoneOf(place(r))] }} />
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
