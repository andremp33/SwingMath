import { X } from 'lucide-react'
import { useMemo } from 'react'
import { mapLayout, type MapPoint } from '../domain/racketMap'
import type { Racket } from '../domain/types'
import { useT } from '../i18n'

/**
 * The racket map, drawn as a poster: a dark panel in either theme, a zone
 * circle in each quadrant, an all-round circle in the middle, and the picked
 * frames as diamonds in the colour of the zone they fall in. Every other
 * frame of the library is a faint dot behind.
 */
const W = 400
const C = 200
const R = 150
const ZR = 54
const at = (p: MapPoint) => ({ x: C + p.x * R, y: C - p.y * R })

/** The panel keeps its own colours, light on dark in both themes. */
const INK = '#ece9e3'
const MUTED = '#9b968d'
const LINE = '#4a4742'
const PANEL = '#121212'

type Zone = 'spinControl' | 'spinPower' | 'touchControl' | 'touchPower' | 'allround'
const ZONE_COLOR: Record<Zone, string> = {
  spinControl: '#f0627f',
  spinPower: '#e5b23a',
  touchControl: '#5b9be8',
  touchPower: '#2fc4a8',
  allround: INK,
}
const D = R * Math.SQRT1_2
const ZONES: { zone: Exclude<Zone, 'allround'>; x: number; y: number }[] = [
  { zone: 'spinControl', x: C - D, y: C - D },
  { zone: 'spinPower', x: C + D, y: C - D },
  { zone: 'touchControl', x: C - D, y: C + D },
  { zone: 'touchPower', x: C + D, y: C + D },
]

/** The zone a point falls in: the middle circle, or its quadrant. */
function zoneOf(p: MapPoint): Zone {
  if (Math.hypot(p.x, p.y) < 0.3) return 'allround'
  return p.y >= 0 ? (p.x < 0 ? 'spinControl' : 'spinPower') : p.x < 0 ? 'touchControl' : 'touchPower'
}

export function RacketMap({ all, picked, onRemove }: { all: Racket[]; picked: Racket[]; onRemove: (id: string) => void }) {
  const t = useT()
  const m = t.library.map
  const stock = useMemo(() => all.filter((r) => r.isStock), [all])
  const place = useMemo(() => mapLayout(stock), [stock])
  const cloud = useMemo(() => stock.map((r) => ({ id: r.id, ...at(place(r)) })), [stock, place])

  // Text the labels must keep off: the zones' names, the centre's, the axis
  // names on the ring, and every diamond.
  const obstacles = useMemo(() => {
    const box = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h })
    const words = (n: number, size: number, spacing: number) => n * (size * 0.62 + spacing)
    const out = ZONES.flatMap((z) => [
      box(z.x, z.y - 5, words(m.zones[z.zone].length, 13.5, 2.6), 16),
      box(z.x, z.y + 12, words(m.zoneSubs[z.zone].length, 9, 0.6), 11),
    ])
    out.push(box(C, C + 3, 88, 30))
    for (const [text, x, y, rot] of [[m.axes.spin, C, C - R, 0], [m.axes.touch, C, C + R, 0], [m.axes.control, C - R, C, 1], [m.axes.power, C + R, C, 1]] as const) {
      const w = text.length * 8.2 + 10
      out.push(rot ? box(x, y, 18, w) : box(x, y, w, 18))
    }
    return out
  }, [m])

  // Each name tries the sides of its diamond in turn, then further up or
  // down; a thin line ties it back when it had to move away.
  const marks = useMemo(() => {
    const dots = picked.map((r) => {
      const p = place(r)
      return { r, color: ZONE_COLOR[zoneOf(p)], ...at(p) }
    })
    const taken = [...obstacles, ...dots.map((d) => ({ x: d.x - 6, y: d.y - 6, w: 12, h: 12 }))]
    const hits = (b: { x: number; y: number; w: number; h: number }, own: { x: number; y: number }) =>
      b.x < 4 ||
      b.x + b.w > W - 4 ||
      taken.some((o) => !(o.x === own.x - 6 && o.y === own.y - 6) && b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)
    return dots
      .sort((a, b) => a.y - b.y)
      .map((d) => {
        const text = `${d.r.model}${d.r.year ? ` ’${String(d.r.year).slice(-2)}` : ''}`.toUpperCase()
        const w = text.length * 6.1
        const h = 11
        const tries: [number, number][] = [[d.x + 9, d.y - 5.5], [d.x - 9 - w, d.y - 5.5]]
        for (let k = 1; k <= 7; k++)
          for (const dy of [-12 * k, 12 * k]) tries.push([d.x + 9, d.y - 5.5 + dy], [d.x - 9 - w, d.y - 5.5 + dy])
        const [lx, ty] = tries.find(([x, y]) => !hits({ x, y, w, h }, d)) ?? tries[0]
        taken.push({ x: lx, y: ty, w, h })
        return { ...d, text, lx, ly: ty + 8.5, w, moved: Math.abs(ty - (d.y - 5.5)) > 1 }
      })
  }, [picked, place, obstacles])

  // Axis names sit on the ring, on a patch of panel that cuts the dashes.
  const axisName = (text: string, x: number, y: number, rotate = 0) => {
    const w = text.length * 8.2 + 10
    return (
      <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
        <rect x={-w / 2} y={-9} width={w} height={18} fill={PANEL} />
        <text y={4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" letterSpacing="1.6" fill={MUTED}>
          {text.toUpperCase()}
        </text>
      </g>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl p-3 sm:p-5" style={{ background: PANEL, color: INK }}>
      <svg viewBox={`0 0 ${W} 430`} className="mx-auto block w-full max-w-120" role="img" aria-label={`${m.title}: ${picked.map((r) => `${r.brand} ${r.model}`).join(', ') || m.empty}`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke={LINE} strokeWidth="2" strokeDasharray="7 7" />
        <line x1={C - R} y1={C} x2={C + R} y2={C} stroke={LINE} strokeWidth="2" />
        <line x1={C} y1={C - R} x2={C} y2={C + R} stroke={LINE} strokeWidth="2" />

        {cloud.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r="2" fill={MUTED} opacity="0.35" />
        ))}

        {ZONES.map((z) => (
          <g key={z.zone}>
            <circle cx={z.x} cy={z.y} r={ZR} fill={PANEL} fillOpacity="0.88" stroke={ZONE_COLOR[z.zone]} strokeWidth="3" />
            <text x={z.x} y={z.y - 1} textAnchor="middle" fontSize="13.5" fontWeight="600" letterSpacing="2.6" fill={ZONE_COLOR[z.zone]}>
              {m.zones[z.zone].toUpperCase()}
            </text>
            <text x={z.x} y={z.y + 15} textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="0.6" fill={ZONE_COLOR[z.zone]}>
              {m.zoneSubs[z.zone].toUpperCase()}
            </text>
          </g>
        ))}
        <g>
          <circle cx={C} cy={C} r="46" fill={PANEL} stroke={INK} strokeWidth="3" />
          <text x={C} y={C + 1} textAnchor="middle" fontSize="10.5" fontWeight="600" letterSpacing="1.4" fill={INK}>
            {m.zones.allround.toUpperCase()}
          </text>
          <text x={C} y={C + 14} textAnchor="middle" fontSize="7.5" fontWeight="600" letterSpacing="0.4" fill={MUTED}>
            {m.zoneSubs.allround.toUpperCase()}
          </text>
        </g>

        {axisName(m.axes.spin, C, C - R)}
        {axisName(m.axes.touch, C, C + R)}
        {axisName(m.axes.control, C - R, C, -90)}
        {axisName(m.axes.power, C + R, C, 90)}

        {marks.map((d) => (
          <g key={d.r.id}>
            {d.moved && <line x1={d.x} y1={d.y} x2={d.lx < d.x ? d.lx + d.w + 1 : d.lx - 1} y2={d.ly - 3.5} stroke={d.color} strokeWidth="1" opacity="0.8" />}
            <rect x={d.x - 4.5} y={d.y - 4.5} width="9" height="9" transform={`rotate(45 ${d.x} ${d.y})`} fill={d.color} stroke={PANEL} strokeWidth="1.5" />
            <text x={d.lx} y={d.ly} fontSize="10" fontWeight="600" letterSpacing="0.4" fill={d.color} stroke={PANEL} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
              {d.text}
            </text>
          </g>
        ))}

        {/* Signed at the foot, as a poster is */}
        <g transform={`translate(${C - 46} 400)`}>
          <path d="M3 21A16 16 0 0 1 19 5" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="3" cy="21" r="2.4" fill={INK} />
          <circle cx="7.7" cy="9.7" r="3.4" fill="#d9764a" />
          <text x="26" y="18" fontSize="15" fontWeight="700" letterSpacing="0.3" fill={INK}>
            SwingMath
          </text>
        </g>
      </svg>

      {picked.length === 0 ? (
        <p className="mt-2 text-center text-sm" style={{ color: MUTED }}>
          {m.empty}
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label={m.title}>
          {picked.map((r) => {
            const color = ZONE_COLOR[zoneOf(place(r))]
            return (
              <li key={r.id} className="flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-0.5 text-sm" style={{ border: `1px solid ${LINE}` }}>
                <span aria-hidden className="size-2 rotate-45" style={{ background: color }} />
                <span style={{ color: MUTED }}>{r.brand}</span> {r.model}
                <button type="button" onClick={() => onRemove(r.id)} aria-label={`${m.remove}: ${r.brand} ${r.model}`} className="rounded-full p-1 hover:bg-white/10" style={{ color: MUTED }}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
