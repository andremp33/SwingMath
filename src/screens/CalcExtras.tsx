import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { armComfort } from '../domain/comfort'
import { GRIP_SIZES, gripInches, gripMm, gripSize } from '../domain/grip'
import { DEFAULT_STRINGBED, stringbedIndex } from '../domain/strings'
import type { GripConfig, Racket, Specs } from '../domain/types'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { fmtNum, gripLabel } from '../lib/format'
import { Segmented, Select } from '../ui/basics'
import { Ring } from '../ui/specs'
import { bedLabel, StringbedEditor, StringbedSummary } from '../ui/strings'
import { CollapsibleCard, InfoTip } from '../ui/disclosure'

/** Kind, middling or harsh for the arm; colour and words together. */
function comfortBand(score: number) {
  if (score >= 65) return { key: 'good' as const, color: 'var(--c-success)' }
  if (score >= 40) return { key: 'mid' as const, color: 'var(--c-warning)' }
  return { key: 'harsh' as const, color: 'var(--c-danger)' }
}

const DEFAULT_GRIP: GripConfig = { base: 2, extraOvergrips: 0, sleeves: 0 }

export function StringsCard({ racket }: { racket: Racket }) {
  const t = useT()
  const bed = useStore((s) => s.config.strings) ?? DEFAULT_STRINGBED
  const setConfig = useStore((s) => s.setConfig)
  const lang = useStore((s) => s.lang)
  return (
    <CollapsibleCard
      id="strings"
      title={t.strings.title}
      summary={`${bedLabel(bed, t, lang)} · ${t.strings.indexShort} ${fmtNum(stringbedIndex(racket, bed), 0, lang)}`}
      info={<InfoTip title={t.strings.index}>{t.strings.indexHint}</InfoTip>}
    >
      <div className="grid grid-cols-1 gap-5 @container sm:grid-cols-2">
        <StringbedEditor value={bed} onChange={(strings) => setConfig({ strings })} />
        <StringbedSummary frame={racket} bed={bed} />
      </div>
      <Link to="/cordas" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text underline-offset-2 hover:underline">
        {t.strings.equivalent} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </CollapsibleCard>
  )
}

export function GripCard() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const grip = useStore((s) => s.config.grip) ?? DEFAULT_GRIP
  const setConfig = useStore((s) => s.setConfig)
  const set = (g: Partial<GripConfig>) => setConfig({ grip: { ...grip, ...g } })
  const size = gripSize(grip.base, grip.extraOvergrips, grip.sleeves)
  const counts = ['0', '1', '2', '3'] as const
  return (
    <CollapsibleCard
      id="grip"
      title={t.grip.title}
      summary={`${t.grip.result}: ${gripLabel(size)} · ${gripInches(size)}`}
      info={<InfoTip title={t.grip.title}>{t.grip.hint}</InfoTip>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t.grip.base}
          value={String(grip.base)}
          onChange={(v) => set({ base: Number(v) })}
          options={GRIP_SIZES.map((n) => ({ value: String(n), label: `L${n} · ${gripInches(n)}` }))}
        />
        <div>
          <span className="mb-1.5 block text-sm">{t.grip.overgrips}</span>
          <Segmented label={t.grip.overgrips} value={String(grip.extraOvergrips) as (typeof counts)[number]} onChange={(v) => set({ extraOvergrips: Number(v) })} options={counts.map((c) => ({ value: c, label: c }))} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm">{t.grip.sleeves}</span>
          <Segmented label={t.grip.sleeves} value={String(grip.sleeves) as (typeof counts)[number]} onChange={(v) => set({ sleeves: Number(v) })} options={counts.map((c) => ({ value: c, label: c }))} />
        </div>
      </div>
      <p className="num mt-3 text-sm">
        {t.grip.result}: <span className="font-semibold">{gripLabel(size)}</span> · {gripInches(size)} · {fmtNum(gripMm(size), 0, lang)} mm
      </p>
    </CollapsibleCard>
  )
}

export function ComfortCard({ racket, specs }: { racket: Racket; specs: Specs }) {
  const t = useT()
  const bed = useStore((s) => s.config.strings) ?? DEFAULT_STRINGBED
  const c = armComfort(specs, racket, bed)
  // Factors that still cost a noticeable number of points.
  const band = comfortBand(c.score)
  const weak = c.factors.filter((f) => f.weight * (1 - f.value) > 0.05).slice(0, 2)
  return (
    <CollapsibleCard
      id="comfort"
      title={t.comfort.title}
      summary={`${c.score} · ${t.comfort.bands[band.key]}`}
      info={<InfoTip title={t.comfort.title}>{t.comfort.hint}</InfoTip>}
    >
      <div className="flex items-start gap-4">
        <Ring value={c.score} label={t.strings.feel.comfort} color={band.color} />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-medium" style={{ color: band.color }}>
            {t.comfort.bands[band.key]}
          </p>
          {weak.length === 0 ? (
            <p>{t.comfort.good}</p>
          ) : (
            <>
              <p className="text-muted">{t.comfort.improve}</p>
              <ul className="space-y-2">
                {weak.map((f) => (
                  <li key={f.key}>
                    <span className="font-medium">{t.comfort.factors[f.key]}</span>
                    <span className="block text-muted">{t.comfort.tips[f.key]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </CollapsibleCard>
  )
}
