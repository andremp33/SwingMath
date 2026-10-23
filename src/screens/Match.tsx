import { Calculator, Plus, Save, Sparkles, Target as TargetIcon, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { matchRackets, solveTarget, toReference, type BatchResult, type MatchResult, type Target, type TargetKey } from '../domain/match'
import type { Base } from '../domain/physics'
import { latestMeasurement } from '../domain/fleet'
import { latestOf, type OwnedRacket, type Stringing } from '../domain/journal'
import { POSITIONS, type Position, type Racket, type SetupConfig } from '../domain/types'
import { findRacket, saveOwned } from '../data/db'
import { useAllRackets, useCustomRackets, useOwned, useRacket, useSetups, useStringings } from '../data/hooks'
import { compute } from '../domain/physics'
import { defaultConfig, isPro, useStore } from '../data/store'
import { diagnose, freePlansLeft, matchPlanKey, targetPlanKey, type Diagnosis } from '../domain/freePlans'
import { PRO_TARGETS, withStrings, type PlainSpecs } from '../data/pros'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned, LOCALE, racketLabel } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, NumberField, PageTitle, Segmented, Select } from '../ui/basics'
import { LEAD_MAX, RacketDiagram } from '../ui/lead'
import { RacketPicker } from '../ui/RacketPicker'
import { ProList } from '../ui/ProPicker'
import { useFreePlans } from './freePlans'
import { ProGate } from './Pro'
import { InfoTip } from '../ui/disclosure'
import { useToast } from '../ui/overlay'

type Mode = 'smart' | 'batch'

export function Match() {
  const t = useT()
  const pro = useStore(isPro)
  const left = freePlansLeft(useStore((s) => s.freePlans))
  // The free plans are shared by both modes, so the count shows once.
  const badge = !pro && <Badge tone="pro">{left <= 0 ? 'Pro' : left === 1 ? t.pro.freePlanOne : fmt(t.pro.freePlans, { n: left })}</Badge>
  const handoff = useLocation().state as MatchHandoff | null
  const [mode, setMode] = useState<Mode>(handoff?.fleet ? 'batch' : 'smart')
  return (
    <>
      <PageTitle action={badge}>{t.match.title}</PageTitle>
      <div className="mb-4 max-w-md">
        <Segmented
          label={t.match.title}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'smart', label: t.match.smart },
            { value: 'batch', label: t.match.batch },
          ]}
        />
      </div>
      {mode === 'smart' ? <Smart /> : <Batch />}
    </>
  )
}

interface Vals {
  weightG?: number
  balanceMm?: number
  swingweight?: number
  twistweight?: number
}

const fromRacket = (r: Racket): Vals => ({
  weightG: Math.round(r.weightG),
  balanceMm: Math.round(r.balanceCm * 10),
  swingweight: Math.round(r.swingweight),
  twistweight: r.twistweight,
})

const toBase = (r: Racket, v: Vals): Base | null =>
  v.weightG === undefined || v.balanceMm === undefined || v.swingweight === undefined
    ? null
    : {
        lengthCm: r.lengthCm,
        headSizeSqIn: r.headSizeSqIn,
        weightG: v.weightG,
        balanceCm: v.balanceMm / 10,
        swingweight: v.swingweight,
        twistweight: v.twistweight,
      }

function SpecFields({ v, onChange, required }: { v: Vals; onChange: (v: Vals) => void; required?: boolean }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label={t.spec.weight} unit="g" min={150} max={500} required={required} value={v.weightG} onChange={(weightG) => onChange({ ...v, weightG })} />
      <NumberField label={t.spec.balance} unit="mm" min={250} max={400} required={required} value={v.balanceMm} onChange={(balanceMm) => onChange({ ...v, balanceMm })} />
      <NumberField label={t.spec.swingweight} min={150} max={450} required={required} value={v.swingweight} onChange={(swingweight) => onChange({ ...v, swingweight })} />
      <NumberField label={t.spec.twistweight} hint={t.common.optional} min={5} max={25} value={v.twistweight} onChange={(twistweight) => onChange({ ...v, twistweight })} />
    </div>
  )
}

/** Where the starting point comes from. */
type Source = 'calc' | 'library' | `owned:${string}` | `setup:${string}`

/** What another screen hands Igualar: a start, a pro as the target, and
 *  whether to solve right away (the free use already counted). */
export interface MatchHandoff {
  from?: Source
  pro?: string
  run?: boolean
  /** The fleet's rackets (owned ids) to match, the reference first. */
  fleet?: string[]
}

/** The starting point: the frame, its numbers, with or without strings, and
 *  the setup behind it when there is one (to open it with the lead added). */
interface Start {
  racketId: string
  vals: Vals
  strung: boolean
  config: SetupConfig | null
}

/** A target as its source gives it, so it can follow the starting point
 *  into the same state (with or without strings). */
interface TargetSrc {
  frame: { headSizeSqIn: number; lengthCm: number }
  specs: PlainSpecs
  strung: boolean
  /** Which target it is, for the free plans: "pro:sinner", "racket:…", "setup:…". */
  origin: string
}

/** A plan as shown: whole, or (past the free plans) only its diagnosis. */
interface Shown {
  plan: MatchResult
  full: boolean
  diag: Diagnosis
}

/** Numbers as the fields show them: weight and balance whole, SW whole. */
const asVals = (s: PlainSpecs & { twistweight?: number }, tw?: boolean): Vals => ({
  weightG: Math.round(s.weightG),
  balanceMm: Math.round(s.balanceCm * 10),
  swingweight: Math.round(s.swingweight),
  twistweight: tw && s.twistweight !== undefined ? Math.round(s.twistweight * 100) / 100 : undefined,
})

/** The player's main racket: the one strung most recently, among those in play. */
function mainRacket(owned: OwnedRacket[], stringings: Stringing[]) {
  const active = owned.filter((o) => !o.retired)
  const last = (o: OwnedRacket) => latestOf(o.id, stringings)?.date ?? o.updatedAt
  return [...active].sort((a, b) => last(b) - last(a))[0]
}

/** Everything the starting point can be, and the default. */
function useStarts(libraryId: string) {
  const config = useStore((s) => s.config)
  const masses = useStore((s) => s.masses)
  const rackets = useAllRackets()
  const owned = useOwned()
  const stringings = useStringings()
  const setups = useSetups()
  const asPlayed = (cfg: SetupConfig): Start | null => {
    const r = rackets.find((x) => x.id === cfg.racketId)
    if (!r) return null
    const { result } = compute({ spec: r, ...cfg, masses })
    return { racketId: r.id, vals: asVals(result, !result.twistweightEstimated), strung: cfg.accessories.strings, config: cfg }
  }
  const ownedConfig = (o: OwnedRacket): SetupConfig => {
    const setup = setups?.find((s) => s.id === o.setupId)
    const bed = latestOf(o.id, stringings ?? [])?.bed
    // Its setup if it has one, else the frame as sold; with its strings on.
    const base = setup && setup.racketId === o.racketId ? setup : defaultConfig(o.racketId)
    return { ...structuredClone(base), accessories: { ...base.accessories, strings: true }, strings: bed ?? base.strings }
  }
  const start = (src: Source): Start | null => {
    if (src === 'calc') return asPlayed(config)
    if (src === 'library') {
      const r = rackets.find((x) => x.id === libraryId)
      return r ? { racketId: r.id, vals: asVals(r, true), strung: false, config: null } : null
    }
    const [kind, id] = src.split(':') as ['owned' | 'setup', string]
    if (kind === 'owned') {
      const o = owned?.find((x) => x.id === id)
      if (!o) return null
      const m = latestMeasurement(o)
      if (!m) return asPlayed(ownedConfig(o))
      // As measured: the numbers are the racket with whatever is on it.
      const measured = { weightG: m.weightG, balanceCm: m.balanceCm, swingweight: m.swingweight, twistweight: m.twistweight }
      const cfg: SetupConfig = {
        ...ownedConfig(o),
        baseMode: 'measured',
        measured,
        accessories: { strings: false, leatherGrip: false, overgrip: false, dampener: false },
        leadG: { tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 },
        extra: [],
      }
      return { racketId: o.racketId, vals: asVals(measured, m.twistweight !== undefined), strung: m.strung, config: cfg }
    }
    const s = setups?.find((x) => x.id === id)
    return s ? asPlayed(s) : null
  }
  const ready = owned !== undefined && stringings !== undefined && setups !== undefined
  const main = ready ? mainRacket(owned, stringings) : undefined
  const latestSetup = setups && [...setups].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const fallback: Source | undefined = !ready ? undefined : main ? `owned:${main.id}` : latestSetup ? `setup:${latestSetup.id}` : 'library'
  return { start, fallback, owned: (owned ?? []).filter((o) => !o.retired), setups: setups ?? [], rackets }
}

function Smart() {
  const plans = useFreePlans()
  const t = useT()
  const setLastPro = useStore((s) => s.setLastPro)
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const pro = useStore(isPro)
  const config = useStore((s) => s.config)
  const loadConfig = useStore((s) => s.loadConfig)
  const masses = useStore((s) => s.masses)
  const customRackets = useCustomRackets()

  // From "How to get there" (comparing a setup with a pro): the setup as
  // the start, the pro as the target, solved once (the use was counted).
  const loc = useLocation()
  const handoff = loc.state as MatchHandoff | null
  const handoffPro = PRO_TARGETS.find((p) => p.id === handoff?.pro)

  const [libraryId, setLibraryId] = useState(config.racketId)
  const starts = useStarts(libraryId)
  const [picked, setPicked] = useState<Source | undefined>(handoff?.from)
  const source = picked ?? starts.fallback
  const start = source ? starts.start(source) : null
  // The player's own numbers, when they change the starting point's.
  const [edited, setEdited] = useState<Vals | null>(null)
  const [editing, setEditing] = useState(false)
  const from = edited ?? start?.vals ?? {}
  const fromStrung = start?.strung ?? false
  const racket = useRacket(start?.racketId)

  const [kind, setKind] = useState<'racket' | 'pro'>(handoffPro ? 'pro' : 'racket')
  const [targetRacketId, setTargetRacketId] = useState<string>()
  const targetRacket = useRacket(targetRacketId)
  const [proId, setProId] = useState(handoffPro?.id ?? '')
  const [targetSrc, setTargetSrc] = useState<TargetSrc | null>(
    handoffPro ? { frame: handoffPro, specs: handoffPro, strung: handoffPro.strung, origin: `pro:${handoffPro.id}` } : null,
  )
  const [typed, setTyped] = useState<Vals | null>(null)
  // A target from a racket, a setup or a pro follows the starting point into
  // its state (with or without strings); numbers typed in stay as typed.
  const to = typed ?? (targetSrc ? asVals(withStrings(targetSrc.frame, targetSrc.specs, targetSrc.strung, fromStrung)) : {})

  const [allowed, setAllowed] = useState<Position[]>([...POSITIONS])
  const [maxPer, setMaxPer] = useState<number | undefined>(LEAD_MAX)
  const [res, setRes] = useState<Shown | null>(null)
  const [err, setErr] = useState<string>()

  const pickSource = (src: Source) => {
    setPicked(src)
    setEdited(null)
    setEditing(false)
    setRes(null)
  }
  const pickTarget = (src: TargetSrc) => {
    setTargetSrc(src)
    setTyped(null)
    setRes(null)
  }

  // A plan is its start and where its target comes from; numbers typed in
  // are one target however they are fine-tuned.
  const planKey = () => targetPlanKey(source === 'library' ? `library:${libraryId}` : (source ?? ''), typed ? 'typed' : (targetSrc?.origin ?? 'typed'))
  const solve = () => {
    setErr(undefined)
    const base = racket && toBase(racket, from)
    if (!base) return setErr(t.racketForm.invalid)
    const target: Target = {
      weightG: to.weightG,
      balanceCm: to.balanceMm === undefined ? undefined : to.balanceMm / 10,
      swingweight: to.swingweight,
      twistweight: base.twistweight === undefined ? undefined : to.twistweight,
    }
    if (Object.values(target).every((x) => x === undefined)) return setErr(t.match.needSpecs)
    const plan = solveTarget(base, target, { allowed, maxPerPositionG: maxPer ?? LEAD_MAX })
    // Counted only now, with a result, and only if it is a new plan.
    const key = planKey()
    const access = plans.access(key)
    plans.record(key, access)
    setRes({ plan, full: access.full, diag: diagnose(base, target, plan) })
  }

  const [autoRun, setAutoRun] = useState(!!handoff?.run)
  useEffect(() => {
    if (!autoRun || !start || !racket) return
    setAutoRun(false)
    solve()
    // Once: a reload does not solve again.
    nav(loc.pathname, { replace: true, state: null })
    // `solve` reads this render's values, which are the ones wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, start, racket])

  const openInCalc = () => {
    // Only a whole plan opens (the diagnosis has no lead to give).
    if (!res?.full || !racket) return
    if (start?.config && !edited) {
      // The setup as it was, with the lead added.
      const cfg = start.config
      const lead = { ...cfg.leadG }
      for (const p of POSITIONS) lead[p] = Math.min(LEAD_MAX, lead[p] + res.plan.lead[p])
      loadConfig({ ...cfg, leadG: lead }, null)
    } else {
      loadConfig(
        {
          racketId: racket.id,
          baseMode: 'measured',
          measured: {
            weightG: from.weightG,
            balanceCm: from.balanceMm === undefined ? undefined : from.balanceMm / 10,
            swingweight: from.swingweight,
            twistweight: from.twistweight,
          },
          accessories: { strings: fromStrung, leatherGrip: false, overgrip: false, dampener: false },
          leadG: res.plan.lead,
        },
        null,
      )
    }
    nav('/')
  }

  const state = (strung: boolean) => (strung ? t.match.strungShort : t.match.unstrungShort)
  const step = (n: number, title: string) => (
    <span className="flex items-center gap-2">
      <span aria-hidden className="grid size-6 place-items-center rounded-full bg-text text-xs font-bold text-bg">
        {n}
      </span>
      {title}
    </span>
  )

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="space-y-4">
        <p className="text-sm text-muted">{t.match.smartIntro}</p>

        <Card className="space-y-3" label={t.match.step1}>
          <CardTitle info={<Badge>{state(fromStrung)}</Badge>}>{step(1, t.match.step1)}</CardTitle>
          <Select<string>
            label={t.match.from}
            value={source ?? ''}
            onChange={(v) => pickSource(v as Source)}
            options={[
              ...starts.owned.map((o) => ({ value: `owned:${o.id}`, label: o.name, group: t.journal.myRackets })),
              ...starts.setups.map((s) => ({ value: `setup:${s.id}`, label: s.name, group: t.match.savedSetups })),
              { value: 'calc', label: t.match.useCalc, group: t.match.other },
              { value: 'library', label: t.match.otherLibrary, group: t.match.other },
            ]}
          />
          {source === 'library' && <RacketPicker label={t.calc.racket} value={racket} onChange={(r) => (setLibraryId(r.id), setEdited(null), setRes(null))} />}
          {start && (
            <div className="rounded-md bg-surface-2 px-3 py-2.5 text-sm">
              {racket && source !== 'library' && <p className="text-muted">{racketLabel(racket)}</p>}
              <p className="num font-semibold">
                {fmtNum(from.weightG, 0, lang)} g · {fmtNum(from.balanceMm, 0, lang)} mm · SW {fmtNum(from.swingweight, 0, lang)}
              </p>
              <p className="text-muted">{fromStrung ? t.match.asPlayed : t.match.asLibrary}</p>
            </div>
          )}
          <button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)} className="text-sm font-medium text-accent-text underline-offset-2 hover:underline">
            {t.match.adjust}
          </button>
          {editing && <SpecFields v={from} onChange={(v) => { setEdited(v); setRes(null) }} required />}
        </Card>

        <Card className="space-y-4" label={t.match.step2}>
          <CardTitle
            info={
              <>
                <Badge>{state(fromStrung)}</Badge>
                <InfoTip title={t.match.to}>{fromStrung ? t.match.basisStrung : t.match.basisUnstrung}</InfoTip>
              </>
            }
          >
            {step(2, t.match.step2)}
          </CardTitle>
          <Segmented
            label={t.match.to}
            value={kind}
            onChange={(k) => {
              setKind(k)
              setRes(null)
            }}
            options={[
              { value: 'racket', label: t.match.kindRacket },
              { value: 'pro', label: t.match.kindPro },
            ]}
          />
          {kind === 'racket' ? (
            <>
              <RacketPicker
                label={t.match.targetRacket}
                value={targetRacket}
                onChange={(r) => {
                  setTargetRacketId(r.id)
                  pickTarget({ frame: r, specs: r, strung: false, origin: `racket:${r.id}` })
                }}
              />
              {starts.setups.length > 0 && (
                <Select
                  label={t.match.targetSetup}
                  value=""
                  onChange={(id) => {
                    const s = starts.setups.find((x) => x.id === id)
                    const r = s && findRacket(s.racketId, customRackets)
                    if (!s || !r) return
                    const { result } = compute({ spec: r, ...s, masses })
                    pickTarget({ frame: r, specs: result, strung: s.accessories.strings, origin: `setup:${s.id}` })
                  }}
                  options={[{ value: '', label: t.match.pickSetup }, ...starts.setups.map((s) => ({ value: s.id, label: s.name }))]}
                />
              )}
            </>
          ) : (
            <ProList
              selected={proId}
              fromStrung={fromStrung}
              onPick={(p) => {
                setProId(p.id)
                setLastPro(p.id)
                pickTarget({ frame: p, specs: p, strung: p.strung, origin: `pro:${p.id}` })
              }}
              // The starting point becomes the stock frame (unstrung, as in the
              // library), and the target follows it into that state.
              onStock={(p) => {
                if (!p.baseRacketId) return
                setLibraryId(p.baseRacketId)
                pickSource('library')
              }}
            />
          )}
          {targetSrc && !typed && targetSrc.strung !== fromStrung && kind === 'racket' && (
            <p className="text-sm font-medium">{fmt(t.match.converted, { from: state(targetSrc.strung), to: state(fromStrung) })}</p>
          )}
          <SpecFields v={to} onChange={(v) => { setTyped(v); setProId(''); setRes(null) }} />
        </Card>

        <Card label={t.match.step3}>
          <CardTitle>{step(3, t.match.step3)}</CardTitle>
          <h3 className="mb-2 text-sm text-muted">{t.match.positions}</h3>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => {
              const on = allowed.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAllowed(on ? allowed.filter((x) => x !== p) : [...allowed, p])}
                  className={cx('rounded-md border px-3 py-1.5 text-sm transition-colors', on ? 'border-text text-text' : 'border-border text-muted hover:text-text')}
                >
                  {t.pos[p]}
                </button>
              )
            })}
          </div>
          <div className="mt-4 max-w-[200px]">
            <NumberField label={t.match.maxPer} unit="g" min={1} max={50} value={maxPer} onChange={setMaxPer} />
          </div>
          {err && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {err}
            </p>
          )}
          <Button variant="primary" size="lg" icon={pro ? TargetIcon : Sparkles} className="mt-4 w-full" onClick={solve} disabled={allowed.length === 0}>
            {t.match.run}
          </Button>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8">{res ? <PlanCard res={res.plan} full={res.full} diag={res.diag} onOpen={openInCalc} /> : null}</div>
    </div>
  )
}

/**
 * A plan. Whole: the lead per position, what is left off, and the way to
 * the calculator. Past the free plans: the diagnosis (what is missing,
 * whether lead gets there, where it lands), and the plan per position
 * behind the Pro gate.
 */
function PlanCard({ res, full, diag, onOpen, title, action }: { res: MatchResult; full: boolean; diag: Diagnosis; onOpen?: () => void; title?: string; action?: ReactNode }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [sel, setSel] = useState<Position>('tip')
  const label: Record<TargetKey, [string, number, string]> = {
    weightG: [t.spec.weight, 0, 'g'],
    balanceCm: [t.spec.balance, 0, 'mm'],
    swingweight: [t.spec.swingweight, 0, ''],
    twistweight: [t.spec.twistweight, 2, ''],
  }
  // "the weight and the swingweight are", said as a sentence, in the player's language.
  const what = new Intl.ListFormat(LOCALE[lang] ?? 'en-GB', { type: 'conjunction' }).format(res.unreachable.map((k) => t.match.unreachableWhat[k]))
  // Lead that changes nothing has no match to speak of.
  const noPlan = res.unreachable.length > 0 && res.totalG < 0.5
  const unreachable =
    res.unreachable.length > 0 ? (
      <div className="mb-3 space-y-1 rounded-md bg-warning/15 px-3 py-2 text-sm">
        <p className="text-warning">{fmt(res.unreachable.length > 1 ? t.match.unreachableMany : t.match.unreachable, { what })}</p>
        {noPlan && <p>{t.match.unreachableHint}</p>}
      </div>
    ) : null
  if (!full) {
    const m = diag.missing
    const parts = [
      m.weightG !== undefined && `${t.spec.weight} ${fmtSigned(m.weightG, 0, lang)} g`,
      m.balanceMm !== undefined && `${t.spec.balance} ${fmtSigned(m.balanceMm, 0, lang)} mm`,
      m.swingweight !== undefined && `SW ${fmtSigned(m.swingweight, 0, lang)}`,
    ].filter(Boolean)
    return (
      <Card label={title ?? t.match.result}>
        <CardTitle>{title ?? t.match.result}</CardTitle>
        {unreachable}
        <dl className="num space-y-2 text-sm">
          <div>
            <dt className="text-muted">{t.match.missing}</dt>
            <dd className="font-semibold">{parts.join(' · ')}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.match.lands}</dt>
            <dd className="font-semibold">
              {fmtNum(diag.final.weightG, 0, lang)} g · {fmtNum(diag.final.balanceCm * 10, 0, lang)} mm · SW {fmtNum(diag.final.swingweight, 0, lang)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm">{diag.reachable ? t.match.reachable : t.match.notReachable}</p>
        <div className="mt-4">
          <ProGate title={t.match.planPro} reason="solver" bare>
            {null}
          </ProGate>
        </div>
      </Card>
    )
  }
  return (
    <Card label={title ?? t.match.result}>
      <CardTitle action={noPlan ? undefined : <Badge plain tone={res.matchPct >= 95 ? 'accent' : 'neutral'}>{fmt(t.match.match, { pct: fmtNum(res.matchPct, res.matchPct === 100 ? 0 : 1, lang) })}</Badge>}>
        {title ?? t.match.result}
      </CardTitle>
      {unreachable}
      <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-4">
        <RacketDiagram lead={res.lead} selected={sel} onSelect={setSel} />
        <dl className="num space-y-1.5 text-sm">
          {POSITIONS.map((p) => (
            <div key={p} className={cx('flex justify-between gap-2', res.lead[p] === 0 && 'text-muted')}>
              <dt>{t.pos[p]}</dt>
              <dd className="font-semibold">{fmtNum(res.lead[p], 1, lang)} g</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1.5 font-bold">
            <dt>{t.calc.totalLead}</dt>
            <dd>{fmtNum(res.totalG, 1, lang)} g</dd>
          </div>
        </dl>
      </div>
      <h3 className="mb-1 mt-4 text-sm text-muted">{t.match.errors}</h3>
      <dl className="num space-y-1 text-sm">
        {(Object.keys(res.errors) as TargetKey[]).map((k) => {
          const [name, d, unit] = label[k]
          const e = k === 'balanceCm' ? res.errors[k]! * 10 : res.errors[k]!
          return (
            <div key={k} className="flex justify-between">
              <dt className="text-muted">{name}</dt>
              <dd className="font-semibold">
                {fmtSigned(e, d, lang)} {unit}
              </dd>
            </div>
          )
        })}
      </dl>
      {onOpen && (
        <Button className="mt-4 w-full" icon={Calculator} onClick={onOpen}>
          {t.match.openInCalc}
        </Button>
      )}
      {action}
    </Card>
  )
}

interface Slot {
  key: string
  racketId?: string
  vals: Vals
  base?: Base | null
  /** One of the player's rackets, from the fleet. */
  owned?: OwnedRacket
}

/** Rackets matched at once: three, or six with Pro (a whole fleet). */
const MAX_SLOTS = { free: 3, pro: 6 }

function Batch() {
  const plans = useFreePlans()
  const t = useT()
  const toast = useToast()
  const pro = useStore(isPro)
  const lang = useStore((s) => s.lang)
  const rackets = useAllRackets()
  const owned = useOwned()
  const fleet = (useLocation().state as MatchHandoff | null)?.fleet
  const [slots, setSlots] = useState<Slot[]>([
    { key: 'a', vals: {} },
    { key: 'b', vals: {} },
  ])
  // A fleet from the profile: each racket as last measured, #1 the target.
  const [seeded, setSeeded] = useState(false)
  const [toFirst, setToFirst] = useState(!!fleet)
  if (fleet && owned && !seeded) {
    setSeeded(true)
    const picked = fleet.map((id) => owned.find((o) => o.id === id)).filter((o): o is OwnedRacket => !!o && !!latestMeasurement(o))
    if (picked.length >= 2)
      setSlots(
        picked.slice(0, MAX_SLOTS.pro).map((o) => {
          const m = latestMeasurement(o)!
          return { key: o.id, racketId: o.racketId, owned: o, vals: { weightG: m.weightG, balanceMm: Math.round(m.balanceCm * 10), swingweight: m.swingweight, twistweight: m.twistweight } }
        }),
      )
  }
  const [res, setRes] = useState<{ batch: BatchResult; full: boolean; diags: Diagnosis[]; toFirst: boolean } | null>(null)
  const [err, setErr] = useState<string>()
  const max = pro ? MAX_SLOTS.pro : MAX_SLOTS.free
  const nameOf = (i: number) => slots[i].owned?.name ?? fmt(t.match.racketN, { n: i + 1 })

  const update = (i: number, s: Partial<Slot>) => {
    setSlots((x) => x.map((y, j) => (j === i ? { ...y, ...s } : y)))
    setRes(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-sm text-muted">
        <p>{t.match.batchIntro}</p>
        <InfoTip title={t.match.batch}>{t.match.sameRacketTwice}</InfoTip>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((s, i) => (
          <BatchSlot
            key={s.key}
            n={i + 1}
            name={s.owned?.name}
            slot={s}
            onChange={(p) => update(i, p)}
            onRemove={slots.length > 2 ? () => setSlots(slots.filter((_, j) => j !== i)) : undefined}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="w-full max-w-md">
          <Segmented
            label={t.match.target}
            value={toFirst ? 'first' : 'common'}
            onChange={(v) => (setToFirst(v === 'first'), setRes(null))}
            options={[
              { value: 'common', label: t.match.targetCommon },
              { value: 'first', label: t.match.targetFirst },
            ]}
          />
        </div>
        {slots.length < max && (
          <Button icon={Plus} onClick={() => setSlots([...slots, { key: String(Date.now()), vals: {} }])}>
            {t.match.addRacket}
          </Button>
        )}
        <Button
          variant="primary"
          icon={pro ? TargetIcon : Sparkles}
          onClick={() => {
            setErr(undefined)
            // A slot from the fleet has its numbers but not yet its frame's.
            const bases = slots.map((s) => {
              const r = s.racketId ? rackets.find((x) => x.id === s.racketId) : undefined
              return s.base ?? (r ? toBase(r, s.vals) : null)
            })
            if (bases.some((b) => !b)) return setErr(t.racketForm.invalid)
            const all = bases as Base[]
            const opts = { maxPerPositionG: LEAD_MAX }
            const batch: BatchResult = toFirst ? toReference(all, opts) : matchRackets(all, opts)
            // The same racquets again (in any order) are the same plan.
            const key = matchPlanKey(slots.map((s) => s.owned?.id ?? s.racketId!)) + (toFirst ? '|first' : '')
            const access = plans.access(key)
            plans.record(key, access)
            setRes({ batch, full: access.full, toFirst, diags: batch.plans.map((p, i) => diagnose(all[i], batch.target, p)) })
          }}
        >
          {t.match.run}
        </Button>
      </div>
      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}
      {res && (
        <>
          <Card label={t.match.commonTarget}>
            <CardTitle action={<Badge plain tone="accent">{fmt(t.match.match, { pct: fmtNum(res.batch.matchPct, 1, lang) })}</Badge>}>
              {res.toFirst ? fmt(t.match.targetIs, { name: nameOf(0) }) : t.match.commonTarget}
            </CardTitle>
            <dl className="num grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label={t.spec.weight} value={`${fmtNum(res.batch.target.weightG, 0, lang)} g`} />
              <Stat label={t.spec.balance} value={`${fmtNum((res.batch.target.balanceCm ?? 0) * 10, 0, lang)} mm`} />
              <Stat label={t.spec.swingweight} value={fmtNum(res.batch.target.swingweight, 0, lang)} />
              {res.batch.target.twistweight !== undefined && <Stat label={t.spec.twistweight} value={fmtNum(res.batch.target.twistweight, 2, lang)} />}
            </dl>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {res.batch.plans.map((p, i) => {
              // Matched to #1, #1 itself has nothing to do.
              if (res.toFirst && i === 0) return null
              const o = slots[i].owned
              const saveLead =
                o && res.full && p.totalG > 0 ? (
                  <Button
                    className="mt-2 w-full"
                    icon={Save}
                    onClick={async () => {
                      await saveOwned({ ...o, lead: { leadG: p.lead }, updatedAt: Date.now() })
                      toast(fmt(t.measurements.leadSaved, { name: o.name }))
                    }}
                  >
                    {fmt(t.measurements.saveLead, { name: o.name })}
                  </Button>
                ) : undefined
              return <PlanCard key={slots[i].key} res={p} full={res.full} diag={res.diags[i]} title={nameOf(i)} action={saveLead} />
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-base font-bold">{value}</dd>
    </div>
  )
}

function BatchSlot({ n, name, slot, onChange, onRemove }: { n: number; name?: string; slot: Slot; onChange: (s: Partial<Slot>) => void; onRemove?: () => void }) {
  const t = useT()
  const racket = useRacket(slot.racketId)
  return (
    <Card className="space-y-4">
      <CardTitle
        action={
          onRemove && (
            <button type="button" onClick={onRemove} aria-label={t.common.delete} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
              <X className="size-4" aria-hidden />
            </button>
          )
        }
      >
        {name ?? fmt(t.match.racketN, { n })}
      </CardTitle>
      <RacketPicker
        label={t.calc.racket}
        value={racket}
        onChange={(r) => {
          const vals = fromRacket(r)
          onChange({ racketId: r.id, vals, base: toBase(r, vals) })
        }}
      />
      {racket && <p className="-mt-2 text-xs text-muted">{racketLabel(racket)}</p>}
      <SpecFields
        v={slot.vals}
        required
        onChange={(vals) => onChange({ vals, base: racket ? toBase(racket, vals) : null })}
      />
    </Card>
  )
}

