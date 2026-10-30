import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FEEL_KEYS, type Feel } from '../domain/feel'
import type { Specs } from '../domain/types'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { fmtNum, fmtSigned } from '../lib/format'
import { G_PER_OZ, MM_PER_IN, useUnits } from '../lib/units'
import { cx } from './basics'
import { SpecGlyph, type SpecKey } from './drawings'
import { Sheet } from './overlay'

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
  const u = useUnits()
  const pts = (p: number) => `${fmtNum(Math.abs(p), 1, lang)} ${p >= 0 ? t.units.pts : t.units.ptsHH}`
  const rows: SpecRow[] = [
    // Weight and balance in the player's units; deltas too (oz and in to hundredths).
    {
      key: 'w',
      label: t.spec.weight,
      value: u.weight(s.weightG),
      unit: u.weightUnit,
      delta: from && (s.weightG - from.weightG) / (u.imperial ? G_PER_OZ : 1),
      deltaDigits: u.imperial ? 2 : undefined,
    },
    {
      key: 'b',
      label: t.spec.balance,
      value: u.balance(s.balanceCm),
      unit: u.balanceUnit,
      sub: pts(s.ptsHL),
      delta: from && ((s.balanceCm - from.balanceCm) * 10) / (u.imperial ? MM_PER_IN : 1),
      deltaDigits: u.imperial ? 2 : undefined,
    },
    { key: 'sw', label: t.spec.swingweight, value: fmtNum(s.swingweight, 0, lang), unit: t.units.kgcm2, delta: from && s.swingweight - from.swingweight },
    {
      key: 'tw',
      label: t.spec.twistweight,
      // Estimated from the head size: "≈", explained in the result's (?).
      value: `${s.twistweightEstimated ? '≈' : ''}${fmtNum(s.twistweight, 1, lang)}`,
      unit: t.units.kgcm2,
      delta: from && s.twistweight !== undefined && from.twistweight !== undefined ? s.twistweight - from.twistweight : undefined,
      deltaDigits: 1,
      muted: s.twistweightEstimated,
    },
  ]
  if (opts.recoil !== false) {
    rows.push({ key: 'rw', label: t.spec.recoil, value: fmtNum(s.recoilWeight, 0, lang), unit: t.units.kgcm2, delta: from && s.recoilWeight - from.recoilWeight })
    rows.push({
      key: 'ss',
      label: t.spec.sweetSpot,
      value: u.length(s.sweetSpotCm),
      unit: u.imperial ? u.lengthUnit : t.units.cm,
      delta: from && (s.sweetSpotCm - from.sweetSpotCm) / (u.imperial ? 2.54 : 1),
    })
  }
  return rows
}

const GLYPHS: SpecKey[] = ['w', 'b', 'sw', 'tw']
const isGlyph = (k: string): k is SpecKey => (GLYPHS as string[]).includes(k)

/** What a number measures: its picture, in plain words, then how we
 *  compute it. Opened from the number's label. */
function SpecSheet({ k, onClose }: { k: SpecKey | null; onClose: () => void }) {
  const t = useT()
  const shown = k ?? 'w'
  const i = GLYPHS.indexOf(shown)
  const title = [t.spec.weight, t.spec.balance, t.spec.swingweight, t.spec.twistweight][i]
  const plain = [t.spec.weightInfo, t.spec.balanceInfo, t.spec.swingweightInfo, t.spec.twistweightInfo][i]
  // "Peso: soma de todas as massas." without its own name.
  const rest = t.info.body[i]?.split(':').slice(1).join(':').trim()
  const how = rest && rest.charAt(0).toUpperCase() + rest.slice(1)
  return createPortal(
    <Sheet open={k !== null} onClose={onClose} title={title}>
      <div className="space-y-3 text-sm leading-relaxed">
        <SpecGlyph k={shown} className="!h-auto w-full max-w-[200px]" />
        <p className="text-base">{plain}</p>
        {how && <p className="text-muted">{how}</p>}
      </div>
    </Sheet>,
    document.body,
  )
}

/** A number's label, with its picture; a tap explains it. */
function SpecLabel({ r, stacked, onOpen }: { r: SpecRow; stacked?: boolean; onOpen: (k: SpecKey) => void }) {
  const t = useT()
  const label = stacked && r.key === 'sw' ? 'SW' : stacked && r.key === 'tw' ? 'TW' : r.label
  if (!isGlyph(r.key)) return <>{label}</>
  const k = r.key
  return (
    <button
      type="button"
      onClick={() => onOpen(k)}
      aria-label={`${t.common.info}: ${r.label}`}
      className={cx('-m-1 flex max-w-full rounded-md p-1 text-left hover:bg-surface-2', stacked ? 'flex-col items-start gap-1' : 'items-center gap-2')}
    >
      <SpecGlyph k={k} className="text-text" />
      <span className="truncate">{label}</span>
    </button>
  )
}

/** Four numbers in a row, for the reference on phones. With `explain`,
 *  each label carries its picture and opens what it means. */
export function SpecStrip({ rows, explain }: { rows: SpecRow[]; explain?: boolean }) {
  const [open, setOpen] = useState<SpecKey | null>(null)
  // Each column as wide as its figure, the room left spread between them:
  // the long ones (kg·cm²) fit a phone's panel without cutting.
  return (
    <>
      <dl className="grid grid-cols-[repeat(4,auto)] justify-between gap-x-2">
        {rows.slice(0, 4).map((r) => (
          <div key={r.key} className="min-w-0">
            <dt className="truncate text-xs text-muted">
              {explain ? <SpecLabel r={r} stacked onOpen={setOpen} /> : r.key === 'sw' ? 'SW' : r.key === 'tw' ? 'TW' : r.label}
            </dt>
            <dd className={cx('num truncate text-base font-semibold', r.muted && 'text-muted')}>
              {r.value}
              {r.unit && <span className="ml-0.5 text-xs font-normal text-muted">{r.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {explain && <SpecSheet k={open} onClose={() => setOpen(null)} />}
    </>
  )
}

export function SpecTable({ rows, showDelta = true, explain }: { rows: SpecRow[]; showDelta?: boolean; explain?: boolean }) {
  const lang = useStore((x) => x.lang)
  const [open, setOpen] = useState<SpecKey | null>(null)
  return (
    <>
      <dl className="divide-y divide-border/70">
        {rows.map((r) => {
          const d = r.delta === undefined ? 0 : Math.round(r.delta * 10 ** (r.deltaDigits ?? 1)) / 10 ** (r.deltaDigits ?? 1)
          return (
            <div key={r.key} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="min-w-0 self-center text-sm text-muted">{explain ? <SpecLabel r={r} onOpen={setOpen} /> : r.label}</dt>
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
      {explain && <SpecSheet k={open} onClose={() => setOpen(null)} />}
    </>
  )
}

/** One ring: a full circle filled to the value, starting at 12 o'clock. An
 *  optional inner ring shows a second setup for comparison. */
export function Ring({ value, compare, label, small, color = 'var(--c-bar)', mark }: { value: number; compare?: number; label: string; small?: boolean; color?: string; mark?: boolean }) {
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
      <span className={cx('text-center text-xs leading-tight', mark ? 'font-semibold text-text' : 'text-muted')}>{label}</span>
    </div>
  )
}

/** The six feel estimates as rings, like a recovery dashboard; the
 *  player's goals have their names in bold. */
export function FeelRings({ feel, compare, labels }: { feel: Feel; compare?: Feel; labels?: [string, string] }) {
  const t = useT()
  const goals = useStore((s) => s.profile.goals) ?? []
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
          <Ring key={k} value={feel[k]} compare={compare?.[k]} label={t.feel[k]} color={`var(--c-${k})`} mark={(goals as string[]).includes(k)} />
        ))}
      </div>
    </div>
  )
}
