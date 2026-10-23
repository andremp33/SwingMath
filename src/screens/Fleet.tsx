import { Target as TargetIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOwned, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { fleetReport, latestMeasurement, needsRemeasure, type Deviation, type Fleet, type Light } from '../domain/fleet'
import { latestOf, type Measurement } from '../domain/journal'
import type { TargetKey } from '../domain/match'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtSigned } from '../lib/format'
import { specLine } from '../lib/specLine'
import { Button, cx, Select, SettingsGroup, SettingsRow } from '../ui/basics'
import { InfoTip } from '../ui/disclosure'
import type { MatchHandoff } from './Match'
import { ProGate } from './Pro'
import { useUnits } from '../lib/units'

const LIGHT_COLOR: Record<Light, string> = { green: 'var(--c-success)', yellow: 'var(--c-warning)', red: 'var(--c-danger)' }

// What Pro adds, behind the lock: a made-up racket, never the player's.
const SAMPLE: { deviation: Deviation; lights: Partial<Record<TargetKey, Light>> } = {
  deviation: { weightG: 2, balanceCm: 0.1, swingweight: 4 },
  lights: { weightG: 'yellow', balanceCm: 'green', swingweight: 'red' },
}

/**
 * The player's rackets as last measured. Free: the list, and when to
 * measure again. Pro: each one against the reference (#1), with a light per
 * spec, and one tap to match the others to it.
 */
export function FleetGroup() {
  const t = useT()
  const units = useUnits()
  const lang = useStore((s) => s.lang)
  const fleetRef = useStore((s) => s.fleetRef)
  const setFleetRef = useStore((s) => s.setFleetRef)
  const nav = useNavigate()
  const owned = useOwned()
  const stringings = useStringings()
  if (!owned || !stringings) return null
  const inPlay = owned.filter((o) => !o.retired)
  if (inPlay.length === 0) return null
  const fleet = fleetReport(inPlay, fleetRef ?? undefined)

  return (
    <SettingsGroup title={t.fleet.title} info={<InfoTip title={t.fleet.title}>{t.fleet.info}</InfoTip>}>
      {inPlay.map((o) => {
        const m = latestMeasurement(o)
        const again = needsRemeasure(o, latestOf(o.id, stringings))
        return (
          <SettingsRow
            key={o.id}
            label={o.name}
            hint={
              <>
                <span className="num">{m ? `${specLine(m, t, lang, units)} · ${fmtDate(m.date, lang)}` : t.fleet.noMeasure}</span>
                {again && <span className="block text-warning">{t.fleet.remeasure}</span>}
              </>
            }
          />
        )
      })}
      <div className="py-3.5">
        <h3 className="mb-2 text-sm font-semibold">{t.fleet.compare}</h3>
        <ProGate title={t.paywall.titles.fleet} reason="fleet" preview={
            <ul>
              <Row name={t.fleet.sample} {...SAMPLE} />
            </ul>
          }>
          <Compare
            fleet={fleet}
            measured={inPlay.filter((o) => latestMeasurement(o)).map((o) => ({ id: o.id, name: o.name }))}
            onReference={setFleetRef}
            onMatch={() => {
              const handoff: MatchHandoff = { fleet: [fleet.reference!.owned.id, ...fleet.others.filter((r) => r.comparable).map((r) => r.owned.id)] }
              nav('/match', { state: handoff })
            }}
          />
        </ProGate>
      </div>
    </SettingsGroup>
  )
}

function Compare({ fleet, measured, onReference, onMatch }: { fleet: Fleet; measured: { id: string; name: string }[]; onReference: (id: string) => void; onMatch: () => void }) {
  const t = useT()
  if (!fleet.reference || fleet.others.length === 0) return <p className="text-sm text-muted">{t.fleet.needTwo}</p>
  const ref = fleet.reference.measurement
  const state = (m: Measurement) => (m.strung ? t.fleet.strung : t.fleet.unstrung)
  return (
    <div className="space-y-4">
      <Select label={t.fleet.reference} value={fleet.reference.owned.id} onChange={onReference} options={measured.map((o) => ({ value: o.id, label: o.name }))} />
      <ul className="divide-y divide-border" aria-label={t.fleet.compare}>
        {fleet.others.map((r) =>
          r.comparable ? (
            <Row key={r.owned.id} name={r.owned.name} deviation={r.deviation!} lights={r.lights!} />
          ) : (
            <li key={r.owned.id} className="py-2.5 text-sm">
              <p className="font-medium">{r.owned.name}</p>
              <p className="text-muted">{fmt(t.fleet.notComparable, { a: state(r.measurement), b: state(ref) })}</p>
            </li>
          ),
        )}
      </ul>
      {fleet.others.some((r) => r.comparable) && (
        <Button variant="primary" icon={TargetIcon} onClick={onMatch}>
          {t.fleet.matchTo}
        </Button>
      )}
    </div>
  )
}

/** The paywall's fleet: the player's rackets by name, their lights blurred
 *  (made-up, as behind the lock). */
export function FleetTeaser({ names }: { names: string[] }) {
  return (
    <ul className="rounded-lg bg-surface-2 px-4 py-1.5">
      {names.map((name) => (
        <Row key={name} name={name} {...SAMPLE} blurred />
      ))}
    </ul>
  )
}

/** One racket against #1: the difference in each spec, with its light. */
function Row({ name, deviation, lights, blurred }: { name: string; deviation: Deviation; lights: Partial<Record<TargetKey, Light>>; blurred?: boolean }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const u = useUnits()
  const shown: [TargetKey, string, string][] = [
    ['weightG', t.spec.weight, u.imperial ? `${u.weightDelta(deviation.weightG ?? 0)} ${u.weightUnit}` : `${fmtSigned(deviation.weightG ?? 0, 0, lang)} g`],
    ['balanceCm', t.spec.balance, u.imperial ? `${u.balanceDelta(deviation.balanceCm ?? 0)} ${u.balanceUnit}` : `${fmtSigned((deviation.balanceCm ?? 0) * 10, 0, lang)} mm`],
    ['swingweight', 'SW', fmtSigned(deviation.swingweight ?? 0, 0, lang)],
    ['twistweight', 'TW', fmtSigned(deviation.twistweight ?? 0, 1, lang)],
  ]
  return (
    <li className="py-2.5 text-sm">
      <p className="font-medium">{name}</p>
      <ul aria-hidden={blurred || undefined} inert={blurred} className={cx('num mt-1 flex flex-wrap gap-x-4 gap-y-1', blurred && 'pointer-events-none blur-sm select-none')}>
        {shown
          .filter(([k]) => deviation[k] !== undefined && lights[k])
          .map(([k, label, v]) => (
            // The light in words too, not only in colour.
            <li key={k} aria-label={fmt(t.fleet.diff, { spec: label, v, light: t.fleet.lights[lights[k]!] })} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: LIGHT_COLOR[lights[k]!] }} />
              <span aria-hidden>
                {k === 'weightG' || k === 'balanceCm' ? '' : `${label} `}
                {v} <span className="text-muted">{t.fleet.lights[lights[k]!]}</span>
              </span>
            </li>
          ))}
      </ul>
    </li>
  )
}
