import { ArrowDown, ArrowRight, ArrowUp, Minus, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { armComfort } from '../domain/comfort'
import { goalAdvice, swingweightForLevel, SW_BY_LEVEL, type GoalMove } from '../domain/goals'
import { GRIP_SIZES, gripInches, gripMm, gripSize } from '../domain/grip'
import { bedBand, DEFAULT_STRINGBED, stringbedIndex } from '../domain/strings'
import type { Geometry } from '../domain/physics'
import { PROBES, sweetSpotEffects, type ProbeKey } from '../domain/sweetSpot'
import { POSITIONS, type ExtraLead, type GripConfig, type Position, type Racket, type Specs } from '../domain/types'
import { feelOffset } from '../data/racketFeel'
import { useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { fmtNum, fmtSigned, gripLabel } from '../lib/format'
import { Button, cx, Segmented, Select } from '../ui/basics'
import { Ring } from '../ui/specs'
import { bedLabel, StringbedEditor, StringbedSummary } from '../ui/strings'
import { CollapsibleCard, InfoTip } from '../ui/disclosure'

/** Kind, middling or harsh for the arm; colour and words together. */
function comfortBand(score: number) {
  if (score >= 65) return { key: 'good' as const, color: 'var(--c-success)' }
  if (score >= 40) return { key: 'mid' as const, color: 'var(--c-warning)' }
  return { key: 'harsh' as const, color: 'var(--c-danger)' }
}

/** "3h e 9h", "4h e 8h": where a sweet spot probe sits. */
const probeLabel = (k: ProbeKey, t: Dict) => (k === 'fourEight' ? fmt(t.custom.hoopBoth, { a: t.custom.hour(4), b: t.custom.hour(8) }) : t.pos[k])

const DEFAULT_GRIP: GripConfig = { base: 2, extraOvergrips: 0, sleeves: 0 }

export function StringsCard({ racket }: { racket: Racket }) {
  const t = useT()
  const bed = useStore((s) => s.config.strings) ?? DEFAULT_STRINGBED
  const setConfig = useStore((s) => s.setConfig)
  const lang = useStore((s) => s.lang)
  const index = stringbedIndex(racket, bed)
  return (
    <CollapsibleCard
      id="strings"
      title={t.strings.title}
      summary={`${bedLabel(bed, t, lang)} · ${t.strings.bands[bedBand(index)].toLowerCase()} (${t.strings.indexShort} ${fmtNum(index, 0, lang)})`}
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

/**
 * The sweet spot (centre of percussion) for this setup, and what 5 g more at
 * each spot would do to it: higher or lower on the frame, and wider.
 */
export function SweetSpotCard({ racket, result, noLead, geo, onAdd }: { racket: Racket; result: Specs; noLead: Specs; geo: Geometry; onAdd: (e: ExtraLead) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const masses = useStore((s) => s.masses)
  const effects = useMemo(() => sweetSpotEffects({ spec: racket, ...config, masses }).sort((a, b) => b.mm - a.mm), [racket, config, masses])
  const centre = result.sweetSpotCm - geo.xc
  const moved = (result.sweetSpotCm - noLead.sweetSpotCm) * 10
  const dir = centre >= 0 ? t.sweet.above : t.sweet.below
  const has48 = (config.extra ?? []).some((e) => e.kind === 'hoop' && e.sides === 2 && (e.hour === 4 || e.hour === 8))
  const max = Math.max(4, ...effects.map((e) => Math.abs(e.mm)))
  const label = (k: ProbeKey) => probeLabel(k, t)
  return (
    <CollapsibleCard
      id="sweet-spot"
      title={t.sweet.title}
      summary={fmt(t.sweet.summary, { cm: fmtNum(result.sweetSpotCm, 1, lang), d: fmtNum(Math.abs(centre), 1, lang), dir })}
      info={<InfoTip title={t.sweet.title}>{t.sweet.info}</InfoTip>}
    >
      <p className="text-sm">
        {fmt(t.sweet.where, { cm: fmtNum(result.sweetSpotCm, 1, lang), d: fmtNum(Math.abs(centre), 1, lang), dir })}
        {Math.abs(moved) >= 0.5 && <> {fmt(t.sweet.moved, { mm: fmtNum(Math.abs(moved), 1, lang), dir: moved > 0 ? t.sweet.up : t.sweet.down })}</>}
      </p>

      <h3 className="mb-1 mt-4 text-sm font-semibold">{t.sweet.effectsTitle}</h3>
      <ul className="divide-y divide-border">
        {effects.map((e) => {
          const up = e.mm >= 0.25
          const down = e.mm <= -0.25
          const Icon = up ? ArrowUp : down ? ArrowDown : Minus
          return (
            <li key={e.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
              <span className="text-sm">{label(e.key)}</span>
              <span className="num order-3 col-span-2 flex items-center gap-2 text-xs text-muted sm:order-none sm:col-span-1">
                {/* A bar either side of the centre line: up the frame to the right. */}
                <span aria-hidden className="relative h-1.5 w-24 shrink-0 rounded-full bg-surface-2">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-border-input" />
                  <span
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      background: up ? 'var(--c-power)' : 'var(--c-stability)',
                      left: e.mm >= 0 ? '50%' : `${50 - (Math.abs(e.mm) / max) * 50}%`,
                      width: `${(Math.abs(e.mm) / max) * 50}%`,
                    }}
                  />
                </span>
                {e.widerPct >= 0.5 && fmt(t.sweet.wider, { n: fmtNum(e.widerPct, 0, lang) })}
              </span>
              <span className="flex items-center justify-end gap-2">
                <span className={cx('num flex items-center gap-1 text-sm font-semibold', !up && !down && 'text-muted')}>
                  <Icon className="size-3.5" aria-hidden />
                  {fmtSigned(e.mm, 1, lang)} mm
                  <span className="sr-only">{up ? t.sweet.up : down ? t.sweet.down : ''}</span>
                </span>
                {e.key === 'fourEight' && !has48 && (
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => onAdd({ id: crypto.randomUUID().slice(0, 8), grams: 0, ...PROBES.fourEight })}>
                    {t.sweet.add}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-sm text-muted">{t.sweet.rule}</p>
    </CollapsibleCard>
  )
}

/**
 * The player's goals (from the profile) on this setup: where each stands,
 * the one change that raises it most, with a tap to make it, and what it
 * costs. With a level, where the swingweight sits for it.
 */
export function GoalsCard({ racket, result }: { racket: Racket; result: Specs }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const masses = useStore((s) => s.masses)
  const goals = useStore((s) => s.profile.goals)
  const level = useStore((s) => s.profile.level)
  const setConfig = useStore((s) => s.setConfig)
  const setLead = useStore((s) => s.setLead)
  const addExtra = useStore((s) => s.addExtra)
  const advice = useMemo(() => (goals?.length ? goalAdvice({ spec: racket, ...config, masses, feelOffset: feelOffset(racket, masses) }, goals) : []), [racket, config, masses, goals])
  const bed = config.strings ?? DEFAULT_STRINGBED

  const describe = (m: GoalMove) =>
    m.kind === 'lead' ? fmt(t.goals.lead, { g: m.grams, where: probeLabel(m.probe, t) }) : fmt(t.goals.tension, { kg: fmtSigned(m.kg, 0, lang) })
  const make = (m: GoalMove) => {
    if (m.kind === 'tension') {
      const kg = (x: number) => x + m.kg
      setConfig({ strings: { mains: { ...bed.mains, tensionKg: kg(bed.mains.tensionKg) }, ...(bed.crosses && { crosses: { ...bed.crosses, tensionKg: kg(bed.crosses.tensionKg) } }) } })
    } else if ((POSITIONS as readonly string[]).includes(m.probe)) {
      const p = m.probe as Position
      setLead(p, config.leadG[p] + m.grams)
    } else {
      addExtra({ id: crypto.randomUUID().slice(0, 8), grams: m.grams, ...PROBES[m.probe] })
    }
  }

  const fit = level && swingweightForLevel(result.swingweight, level)
  const [lo, hi] = level ? SW_BY_LEVEL[level] : [0, 0]
  const summary = advice.length ? advice.map((a) => `${t.community.goals[a.goal]} ${Math.round(a.now)}`).join(' · ') : t.goals.pick
  return (
    <CollapsibleCard id="goals" title={t.goals.title} summary={summary} info={<InfoTip title={t.goals.title}>{t.goals.hint}</InfoTip>}>
      {advice.length === 0 ? (
        <p className="text-sm text-muted">
          {t.goals.none}{' '}
          <Link to="/perfil" className="font-semibold text-accent-text">
            {t.goals.pick}
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {advice.map((a) => (
            <li key={a.goal} className="flex items-center gap-3 py-2.5">
              <span className="readout w-9 shrink-0 text-center text-lg" style={{ color: `var(--c-${a.goal})` }}>
                {Math.round(a.now)}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{t.community.goals[a.goal]}</p>
                {a.best ? (
                  <p className="num text-muted">
                    {describe(a.best.move)} <span className="font-semibold text-success">{fmtSigned(a.best.gain, 0, lang)}</span>
                    {a.best.cost && (
                      <>
                        {' · '}
                        {fmtSigned(a.best.cost.delta, 0, lang)} {t.community.goals[a.best.cost.goal].toLowerCase()}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-muted">{t.goals.nothing}</p>
                )}
              </div>
              {a.best && (
                <Button size="sm" variant="secondary" icon={a.best.move.kind === 'lead' ? Plus : undefined} onClick={() => make(a.best!.move)}>
                  {a.best.move.kind === 'lead' ? t.goals.add : t.goals.apply}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {fit && level && (
        <p className={cx('num mt-3 flex items-start gap-1.5 text-sm', fit === 'within' ? 'text-muted' : 'text-warning')}>
          <span className="min-w-0 flex-1">
            {fmt(t.goals.level[fit], { sw: fmtNum(result.swingweight, 0, lang), level: t.community.levels[level].toLowerCase(), lo, hi })}
          </span>
          <InfoTip title={t.community.level}>{t.goals.levelHint}</InfoTip>
        </p>
      )}
    </CollapsibleCard>
  )
}
