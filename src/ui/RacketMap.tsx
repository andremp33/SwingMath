import { X } from 'lucide-react'
import { useMemo } from 'react'
import { mapLayout, type MapPoint } from '../domain/racketMap'
import type { Racket } from '../domain/types'
import { useT } from '../i18n'

/** Colours for the picked frames, in order. */
const PALETTE = ['var(--c-power)', 'var(--c-stability)', 'var(--c-spin)', 'var(--c-control)', 'var(--c-comfort)', 'var(--c-plow)', 'var(--c-manoeuvrability)', 'var(--c-text)']

const C = 200
const R = 160
const at = (p: MapPoint) => ({ x: C + p.x * R, y: C - p.y * R })

/**
 * Every frame of the library as a faint dot, and the picked ones in colour
 * with their names: control to power across, touch to spin up and down.
 */
export function RacketMap({ all, picked, onRemove }: { all: Racket[]; picked: Racket[]; onRemove: (id: string) => void }) {
  const t = useT()
  const m = t.library.map
  const place = useMemo(() => mapLayout(all.filter((r) => r.isStock)), [all])
  const cloud = useMemo(() => all.filter((r) => r.isStock).map((r) => at(place(r))), [all, place])

  // Labels: right of the dot (left near the right edge), moved down when
  // they would sit on another label or on the centre's name; a line then
  // ties each one to its dot.
  const marks = useMemo(() => {
    const dots = picked.map((r, i) => ({ r, color: PALETTE[i % PALETTE.length], ...at(place(r)) }))
    // Obstacles: the centre's name and every diamond (as a box on its line).
    const placed: { x: number; y: number; w: number }[] = [{ x: C - 34, y: C + 50, w: 68 }, ...dots.map((d) => ({ x: d.x - 8, y: d.y + 4, w: 16 }))]
    return dots
      .sort((a, b) => a.y - b.y)
      .map((d) => {
        const text = `${d.r.model}${d.r.year ? ` ${d.r.year}` : ''}`
        const w = Math.min(150, text.length * 6.2)
        let lx = d.x + 10
        if (lx + w > 396) lx = d.x - 10 - w
        let ly = d.y + 4
        const own = (p: { x: number; y: number }) => p.x === d.x - 8 && p.y === d.y + 4
        while (placed.some((p) => !own(p) && Math.abs(p.y - ly) < 13 && lx < p.x + p.w && lx + w > p.x)) ly += 13
        placed.push({ x: lx, y: ly, w })
        return { ...d, text, lx, ly, w, moved: Math.abs(ly - (d.y + 4)) > 1 }
      })
  }, [picked, place])

  const corners = [
    { x: 8, y: 22, anchor: 'start', name: m.zones.spinControl },
    { x: 392, y: 22, anchor: 'end', name: m.zones.spinPower },
    { x: 8, y: 388, anchor: 'start', name: m.zones.touchControl },
    { x: 392, y: 388, anchor: 'end', name: m.zones.touchPower },
  ] as const

  return (
    <div>
      <svg viewBox="0 0 400 400" className="mx-auto block w-full max-w-[460px]" role="img" aria-label={`${m.title}: ${picked.map((r) => `${r.brand} ${r.model}`).join(', ') || m.empty}`}>
        <defs>
          <clipPath id="map-disc">
            <circle cx={C} cy={C} r={R} />
          </clipPath>
        </defs>
        {/* Quadrants: two tinted, two plain, so the four areas read at a glance */}
        <g clipPath="url(#map-disc)" fill="var(--c-surface-2)">
          <rect x={C - R} y={C - R} width={R} height={R} />
          <rect x={C} y={C} width={R} height={R} />
        </g>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--c-border-input)" strokeDasharray="5 6" />
        <line x1={C - R - 8} y1={C} x2={C + R + 8} y2={C} stroke="var(--c-border-input)" />
        <line x1={C} y1={C - R - 8} x2={C} y2={C + R + 8} stroke="var(--c-border-input)" />
        <circle cx={C} cy={C} r="34" fill="none" stroke="var(--c-text-muted)" strokeDasharray="3 4" />
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

        {cloud.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.2" fill="var(--c-text-muted)" opacity="0.35" />
        ))}
        {marks.map((d) => (
          <g key={d.r.id}>
            {d.moved && <line x1={d.x} y1={d.y} x2={d.lx < d.x ? d.lx + d.w + 2 : d.lx - 2} y2={d.ly - 4} stroke={d.color} strokeWidth="1.2" />}
            <rect x={d.x - 5.5} y={d.y - 5.5} width="11" height="11" transform={`rotate(45 ${d.x} ${d.y})`} fill={d.color} stroke="var(--c-bg)" strokeWidth="1.5" />
            <text x={d.lx} y={d.ly} fontSize="11" fontWeight="600" fill="var(--c-text)" stroke="var(--c-bg)" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
              {d.text}
            </text>
          </g>
        ))}
      </svg>

      {picked.length === 0 ? (
        <p className="mt-2 text-center text-sm text-muted">{m.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={m.title}>
          {picked.map((r, i) => (
            <li key={r.id} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-0.5 text-sm">
              <span aria-hidden className="size-2.5 rotate-45" style={{ background: PALETTE[i % PALETTE.length] }} />
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
