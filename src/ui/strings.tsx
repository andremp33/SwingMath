import { ExternalLink, History } from 'lucide-react'
import { useId, useState } from 'react'
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
import { findString, gaugeLabel, pickString, suggestStrings, type CatalogString } from '../data/stringCatalog'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum, kgToLb } from '../lib/format'
import { cx, Label, NumberField, Select, Toggle } from './basics'

export { bedLabel } from '../lib/bedLabel'

/**
 * The string's name, with suggestions from the catalogue (by brand or model)
 * and the player's last strings first. Any name may be typed.
 */
function StringName({ label, value, onType, onPick }: { label: string; value: string; onType: (name: string) => void; onPick: (name: string, s?: CatalogString) => void }) {
  const t = useT()
  const id = useId()
  const recent = useStore((s) => s.recentStrings)
  const noteString = useStore((s) => s.noteString)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const list = open ? suggestStrings(value, recent) : []
  const shown = list.length > 0
  const choose = (i: number) => {
    const o = list[i]
    if (!o) return
    onPick(o.name, o.string)
    noteString(o.name)
    setOpen(false)
  }
  const option = (i: number) => {
    const o = list[i]
    return (
      <li
        key={o.name}
        id={`${id}-o${i}`}
        role="option"
        aria-selected={i === active}
        // Keeps the focus in the field.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(i)}
        onMouseEnter={() => setActive(i)}
        className={cx('flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm', i === active && 'bg-surface-2')}
      >
        <span className="min-w-0 truncate">
          {o.string ? (
            <>
              <span className="text-muted">{o.string.brand}</span> <span className="font-medium">{o.string.model}</span>
            </>
          ) : (
            <span className="font-medium">{o.name}</span>
          )}
        </span>
        {/* A hint for the eye; the option's name is the string's. */}
        {o.string && (
          <span aria-hidden className="shrink-0 text-xs text-muted">
            {t.strings.short[o.string.material]}
          </span>
        )}
      </li>
    )
  }
  const recentRows = list.map((o, i) => [o, i] as const).filter(([o]) => o.recent)
  const otherRows = list.map((o, i) => [o, i] as const).filter(([o]) => !o.recent)
  return (
    <div className="relative">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown ? `${id}-o${active}` : undefined}
        autoComplete="off"
        maxLength={60}
        placeholder={t.strings.namePlaceholder}
        className="h-11 w-full rounded-md border border-border-input bg-field px-3 text-base text-text placeholder:text-muted/80 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent-text"
        value={value}
        onChange={(e) => {
          onType(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          if (value.trim()) noteString(value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            if (list.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length)
          } else if (e.key === 'Enter' && shown) {
            e.preventDefault()
            choose(active)
          } else if (e.key === 'Escape' && shown) {
            // Closes the list, not the sheet around it.
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      <ul id={`${id}-list`} role="listbox" aria-label={label} hidden={!shown} className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
        {recentRows.length > 0 && (
          <li role="presentation" className="flex items-center gap-1.5 px-3 pb-1 pt-1.5 text-xs text-muted">
            <History className="size-3.5" aria-hidden /> {t.strings.recent}
          </li>
        )}
        {recentRows.map(([, i]) => option(i))}
        {recentRows.length > 0 && otherRows.length > 0 && (
          <li role="presentation" className="px-3 pb-1 pt-2 text-xs text-muted">
            {t.strings.catalogue}
          </li>
        )}
        {otherRows.map(([, i]) => option(i))}
      </ul>
    </div>
  )
}

/** One side of the bed: the string's name, then its gauge (a catalogue
 *  string) or its material (any other), and the tension. */
export function StringSpecFields({ value, onChange, title }: { value: StringSpec; onChange: (s: StringSpec) => void; title?: string }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const known = findString(value.name)
  const of = (l: string) => (title ? `${l} (${title.toLowerCase()})` : l)
  return (
    <div className="space-y-3">
      <div>
        <StringName
          label={of(t.strings.name)}
          value={value.name ?? ''}
          onType={(name) => {
            const s = findString(name)
            onChange(s ? pickString({ ...value, name }, s) : { ...value, name: name.trim() ? name : undefined, gaugeMm: undefined })
          }}
          onPick={(name, s) => onChange(s ? pickString(value, s) : { ...value, name })}
        />
        {known && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            {t.strings.materials[known.material]} ·{' '}
            <a href={known.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-text">
              {t.strings.source} <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        {known ? (
          <Select<string>
            label={of(t.strings.gauge)}
            value={value.gaugeMm !== undefined ? String(value.gaugeMm) : ''}
            onChange={(g) => onChange({ ...value, gaugeMm: g ? Number(g) : undefined })}
            options={[
              { value: '', label: t.strings.gaugeUnknown },
              ...known.gaugesMm.map((mm) => {
                const us = gaugeLabel(known, mm)
                return { value: String(mm), label: us ? `${us} (${fmtNum(mm, 2, lang)} mm)` : `${fmtNum(mm, 2, lang)} mm` }
              }),
            ]}
          />
        ) : (
          <Select<StringMaterial>
            label={of(t.strings.material)}
            value={value.material}
            onChange={(material) => onChange({ ...value, material })}
            options={MATERIALS.map((m) => ({ value: m, label: t.strings.materials[m] }))}
          />
        )}
        <NumberField
          label={of(t.strings.tension)}
          unit="kg"
          min={10}
          max={40}
          hint={fmt(t.strings.lb, { n: fmtNum(kgToLb(value.tensionKg), 0, lang) })}
          value={value.tensionKg}
          onChange={(v) => v !== undefined && onChange({ ...value, tensionKg: v })}
        />
      </div>
    </div>
  )
}

/** The strings, with an optional hybrid: mains and crosses each get their own. */
export function StringbedEditor({ value, onChange }: { value: Stringbed; onChange: (b: Stringbed) => void }) {
  const t = useT()
  const hybrid = value.crosses !== undefined
  return (
    <div className="space-y-3">
      <StringSpecFields value={value.mains} onChange={(mains) => onChange({ ...value, mains })} title={hybrid ? t.strings.mains : undefined} />
      <Toggle
        label={t.strings.hybrid}
        checked={hybrid}
        // The crosses start as another material at the same tension, unnamed.
        onChange={(on) => onChange(on ? { ...value, crosses: { tensionKg: value.mains.tensionKg, material: value.mains.material === 'poly' ? 'multi' : 'poly' } } : { mains: value.mains })}
      />
      {value.crosses && <StringSpecFields value={value.crosses} onChange={(crosses) => onChange({ ...value, crosses })} title={t.strings.crosses} />}
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
