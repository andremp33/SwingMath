import { FEEL_KEYS, type Feel } from '../domain/feel'
import type { Specs } from '../domain/types'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { fmtNum, fmtSigned } from '../lib/format'
import { cx } from './basics'

export interface SpecRow {
  key: string
  label: string
  value: string
  unit?: string
  sub?: string
  delta?: number
  deltaDigits?: number
  muted?: boolean
}

export function useSpecRows(s: Specs, from?: Specs, opts: { recoil?: boolean } = {}): SpecRow[] {
  const t = useT()
  const lang = useStore((x) => x.lang)
  const pts = (p: number) => `${fmtNum(Math.abs(p), 1, lang)} ${p >= 0 ? t.units.pts : t.units.ptsHH}`
  const rows: SpecRow[] = [
    { key: 'w', label: t.spec.weight, value: fmtNum(s.weightG, 1, lang), unit: t.units.g, delta: from && s.weightG - from.weightG },
    {
      key: 'b',
      label: t.spec.balance,
      value: fmtNum(s.balanceCm * 10, 1, lang),
      unit: t.units.mm,
      sub: pts(s.ptsHL),
      delta: from && (s.balanceCm - from.balanceCm) * 10,
    },
    { key: 'sw', label: t.spec.swingweight, value: fmtNum(s.swingweight, 1, lang), delta: from && s.swingweight - from.swingweight },
    {
      key: 'tw',
      label: t.spec.twistweight,
      value: fmtNum(s.twistweight, 2, lang),
      sub: s.twistweightEstimated ? t.common.estimated : undefined,
      delta: from && s.twistweight !== undefined && from.twistweight !== undefined ? s.twistweight - from.twistweight : undefined,
      deltaDigits: 2,
      muted: s.twistweightEstimated,
    },
  ]
  if (opts.recoil !== false) {
    rows.push({ key: 'rw', label: t.spec.recoil, value: fmtNum(s.recoilWeight, 1, lang), delta: from && s.recoilWeight - from.recoilWeight })
    rows.push({
      key: 'ss',
      label: t.spec.sweetSpot,
      value: fmtNum(s.sweetSpotCm, 1, lang),
      unit: t.units.cm,
      sub: t.spec.sweetSpotUnit,
      delta: from && s.sweetSpotCm - from.sweetSpotCm,
    })
  }
  return rows
}

export function SpecTable({ rows, showDelta = true }: { rows: SpecRow[]; showDelta?: boolean }) {
  const lang = useStore((x) => x.lang)
  return (
    <dl className="divide-y divide-border/70">
      {rows.map((r) => {
        const d = r.delta === undefined ? 0 : Math.round(r.delta * 10 ** (r.deltaDigits ?? 1)) / 10 ** (r.deltaDigits ?? 1)
        return (
          <div key={r.key} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted">{r.label}</dt>
            <dd className="flex items-baseline gap-2 text-right">
              {showDelta && r.delta !== undefined && d !== 0 && (
                <span className="text-xs text-muted">{fmtSigned(r.delta, r.deltaDigits ?? 1, lang)}</span>
              )}
              <span className={cx('readout text-lg', r.muted && 'text-muted')}>{r.value}</span>
              {r.unit && <span className="-ml-1 text-sm text-muted">{r.unit}</span>}
              {r.sub && <span className="text-xs text-muted">{r.sub}</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** One ring: a full circle filled to the value, starting at 12 o'clock. An
 *  optional inner ring shows a second setup for comparison. */
export function Ring({ value, compare, label, small, color = 'var(--c-bar)' }: { value: number; compare?: number; label: string; small?: boolean; color?: string }) {
  const R = 34
  const C = 2 * Math.PI * R
  const r2 = 25
  const C2 = 2 * Math.PI * r2
  return (
    <div className="flex flex-col items-center gap-1.5" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={small ? 'relative size-[68px]' : 'relative size-[84px]'}>
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--c-border)" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - value / 100)}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
          {compare !== undefined && (
            <>
              <circle cx="40" cy="40" r={r2} fill="none" stroke="var(--c-border)" strokeWidth="4" />
              <circle
                cx="40"
                cy="40"
                r={r2}
                fill="none"
                stroke="var(--c-text-muted)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={C2}
                strokeDashoffset={C2 * (1 - compare / 100)}
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </>
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={small ? 'readout text-base leading-none' : 'readout text-lg leading-none'}>
            {value}
            {compare !== undefined && <span className="block text-center text-[11px] font-normal text-muted">{compare}</span>}
          </span>
        </span>
      </div>
      <span className="text-center text-xs leading-tight text-muted">{label}</span>
    </div>
  )
}

/** The six feel estimates as rings, like a recovery dashboard. */
export function FeelRings({ feel, compare, labels }: { feel: Feel; compare?: Feel; labels?: [string, string] }) {
  const t = useT()
  return (
    <div>
      {labels && compare && (
        <div className="mb-3 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-text" /> {labels[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-muted" /> {labels[1]}
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-x-2 gap-y-4">
        {FEEL_KEYS.map((k) => (
          <Ring key={k} value={feel[k]} compare={compare?.[k]} label={t.feel[k]} color={`var(--c-${k})`} />
        ))}
      </div>
    </div>
  )
}
