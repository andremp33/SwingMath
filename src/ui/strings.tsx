import { MATERIALS, stringbedIndex, stringFeel, STRING_FEEL_KEYS, type FrameForStrings, type Stringbed, type StringMaterial, type StringSpec } from '../domain/strings'
import { useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { fmtNum, kgToLb } from '../lib/format'
import { NumberField, Select, Toggle } from './basics'
import { Ring } from './specs'

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

/** Stringbed stiffness and how the bed plays, as rings. */
export function StringbedSummary({ frame, bed }: { frame: FrameForStrings; bed: Stringbed }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const f = stringFeel(frame, bed)
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{t.strings.index}</span>
        <span className="readout text-2xl">{fmtNum(stringbedIndex(frame, bed), 0, lang)}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-1">
        {STRING_FEEL_KEYS.map((k) => (
          <Ring key={k} value={f[k]} label={t.strings.feel[k]} color={`var(--c-${k})`} small />
        ))}
      </div>
      <p className="text-xs text-muted">{t.strings.indexHint}</p>
    </div>
  )
}
