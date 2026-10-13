import {
  BED_BANDS,
  BED_SCALE,
  bedBand,
  MATERIALS,
  stringbedIndex,
  stringFeel,
  STRING_FEEL_KEYS,
  tensionTicks,
  type FrameForStrings,
  type Stringbed,
  type StringMaterial,
  type StringSpec,
} from '../domain/strings'
import { useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { fmtNum, kgToLb } from '../lib/format'
import { cx, NumberField, Select, Toggle } from './basics'

/** "Poli 23 kg", or "Poli 24 / Multi 22 kg" for a hybrid. */
export function bedLabel(bed: Stringbed, t: Dict, lang: string) {
  const one = (s: StringSpec) => `${t.strings.short[s.material]} ${fmtNum(s.tensionKg, s.tensionKg % 1 ? 1 : 0, lang)}`
  return bed.crosses ? `${one(bed.mains)} / ${one(bed.crosses)} kg` : `${one(bed.mains)} kg`
}

function SpecFields({ value, onChange, title }: { value: StringSpec; onChange: (s: StringSpec) => void; title?: string }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
      <Select<StringMaterial>
        label={title ? `${t.strings.material} (${title.toLowerCase()})` : t.strings.material}
        value={value.material}
        onChange={(material) => onChange({ ...value, material })}
        options={MATERIALS.map((m) => ({ value: m, label: t.strings.materials[m] }))}
      />
      <NumberField
        label={title ? `${t.strings.tension} (${title.toLowerCase()})` : t.strings.tension}
        unit="kg"
        min={10}
        max={40}
        hint={fmt(t.strings.lb, { n: fmtNum(kgToLb(value.tensionKg), 0, lang) })}
        value={value.tensionKg}
        onChange={(v) => v !== undefined && onChange({ ...value, tensionKg: v })}
      />
    </div>
  )
}

/** Material and tension, with an optional hybrid. */
export function StringbedEditor({ value, onChange }: { value: Stringbed; onChange: (b: Stringbed) => void }) {
  const t = useT()
  const hybrid = value.crosses !== undefined
  return (
    <div className="space-y-3">
      <SpecFields value={value.mains} onChange={(mains) => onChange({ ...value, mains })} title={hybrid ? t.strings.mains : undefined} />
      <Toggle
        label={t.strings.hybrid}
        checked={hybrid}
        onChange={(on) => onChange(on ? { ...value, crosses: { ...value.mains, material: value.mains.material === 'poly' ? 'multi' : 'poly' } } : { mains: value.mains })}
      />
      {value.crosses && <SpecFields value={value.crosses} onChange={(crosses) => onChange({ ...value, crosses })} title={t.strings.crosses} />}
    </div>
  )
}

/** Where an index sits along the scale, 0-1. */
const along = (index: number) => (Math.min(BED_SCALE.max, Math.max(BED_SCALE.min, index)) - BED_SCALE.min) / (BED_SCALE.max - BED_SCALE.min)
const at = (index: number) => `${along(index) * 100}%`
// One ink, more of it the firmer the band: the scale reads soft to firm in
// either theme without a colour that looks like good or bad.
const BAND_INK = { soft: 18, medium: 34, firm: 55 } as const

/**
 * Stringbed stiffness on a soft-to-firm scale: the band in words, and where
 * these strings would sit at other tensions on this frame, so the number
 * reads in kilos the player already knows.
 */
export function StiffnessScale({ frame, bed }: { frame: FrameForStrings; bed: Stringbed }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const index = stringbedIndex(frame, bed)
  const band = bedBand(index)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{t.strings.index}</span>
        <span className="readout text-2xl">{fmtNum(index, 0, lang)}</span>
      </div>
      <p className="text-sm">
        <span className="font-semibold">{t.strings.bands[band]}</span>
        <span className="text-muted"> · {t.strings.bandHints[band]}</span>
      </p>
      <div
        role="meter"
        aria-label={t.strings.index}
        aria-valuenow={Math.round(Math.min(BED_SCALE.max, Math.max(BED_SCALE.min, index)))}
        aria-valuemin={BED_SCALE.min}
        aria-valuemax={BED_SCALE.max}
        aria-valuetext={`${fmtNum(index, 0, lang)}, ${t.strings.bands[band]}`}
        className="mt-3"
      >
        <div aria-hidden className="relative h-4 text-xs">
          {BED_BANDS.map((b) => (
            <span
              key={b.key}
              className={cx('absolute top-0 -translate-x-1/2 whitespace-nowrap', b.key === band ? 'font-semibold text-text' : 'text-muted')}
              style={{ left: at((b.from + b.to) / 2) }}
            >
              {t.strings.bands[b.key]}
            </span>
          ))}
        </div>
        <div aria-hidden className="relative mt-1.5 h-2">
          {BED_BANDS.map((b, i) => (
            <span
              key={b.key}
              className={cx('absolute inset-y-0', i === 0 && 'rounded-l-full', i === BED_BANDS.length - 1 && 'rounded-r-full')}
              style={{
                // A 2px surface gap between bands.
                left: i === 0 ? at(b.from) : `calc(${at(b.from)} + 1px)`,
                right: i === BED_BANDS.length - 1 ? `calc(100% - ${at(b.to)})` : `calc(100% - ${at(b.to)} + 1px)`,
                background: `color-mix(in oklab, var(--c-text) ${BAND_INK[b.key]}%, var(--c-surface))`,
              }}
            />
          ))}
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface transition-[left] duration-300 ease-out"
            style={{ left: at(index) }}
          />
        </div>
        <div aria-hidden className="relative mt-1 h-5">
          {/* A label centred on either end would spill out of the card. */}
          {tensionTicks(frame, bed).filter((k) => along(k.index) >= 0.04 && along(k.index) <= 0.96).map((k) => (
            <span key={k.kg} className="num absolute top-0 flex -translate-x-1/2 flex-col items-center text-[11px] leading-none text-muted" style={{ left: at(k.index) }}>
              <span className="mb-1 h-1 w-px bg-border-input" />
              {k.kg}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t.strings.ticks}</p>
      </div>
    </div>
  )
}

/** Stringbed stiffness and how the bed plays. The feel is four thin bars,
 *  not rings: the calculator already has the frame's feel as rings. */
export function StringbedSummary({ frame, bed }: { frame: FrameForStrings; bed: Stringbed }) {
  const t = useT()
  const f = stringFeel(frame, bed)
  return (
    <div className="space-y-4">
      <StiffnessScale frame={frame} bed={bed} />
      <div className="space-y-2">
        {STRING_FEEL_KEYS.map((k) => (
          <div key={k} role="meter" aria-label={t.strings.feel[k]} aria-valuenow={Math.round(f[k])} aria-valuemin={0} aria-valuemax={100} className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
            <span className="text-muted">{t.strings.feel[k]}</span>
            <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-border">
              <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${f[k]}%`, background: `var(--c-${k})` }} />
            </span>
            <span className="num text-right font-semibold">{Math.round(f[k])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
