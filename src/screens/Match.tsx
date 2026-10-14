import { Calculator, ExternalLink, Play, Plus, Sparkles, Target as TargetIcon, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchRackets, solveTarget, type BatchResult, type MatchResult, type Target, type TargetKey } from '../domain/match'
import type { Base } from '../domain/physics'
import { latestOf, type OwnedRacket, type Stringing } from '../domain/journal'
import { POSITIONS, type Position, type Racket, type SetupConfig } from '../domain/types'
import { findRacket } from '../data/db'
import { useAllRackets, useCustomRackets, useOwned, useRacket, useSetups, useStringings } from '../data/hooks'
import { compute } from '../domain/physics'
import { defaultConfig, FREE_PRO_RUNS, isPro, useStore } from '../data/store'
import { PRO_TARGETS, withStrings, type PlainSpecs, type ProTarget } from '../data/pros'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned, LOCALE, racketLabel } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, NumberField, PageTitle, Segmented, Select, TextField } from '../ui/basics'
import { LEAD_MAX, RacketDiagram } from '../ui/lead'
import { RacketPicker } from '../ui/RacketPicker'
import { usePaywall } from './Pro'
import { InfoTip } from '../ui/disclosure'

type Mode = 'smart' | 'batch'

/** Pro tools work a few times before buying, so people can try first. */
function useTryFirst() {
  const pro = useStore(isPro)
  const used = useStore((s) => s.freeRunsUsed)
  const spend = useStore((s) => s.spendFreeRun)
  const paywall = usePaywall()
  return () => {
    if (pro) return true
    if (used >= FREE_PRO_RUNS) {
      paywall('solver')
      return false
    }
    spend()
    return true
  }
}

export function Match() {
  const t = useT()
  const pro = useStore(isPro)
  const left = FREE_PRO_RUNS - useStore((s) => s.freeRunsUsed)
  // The free uses are shared by both modes, so the count shows once.
  const badge = !pro && <Badge tone="pro">{left <= 0 ? 'Pro' : left === 1 ? t.pro.freeUseOne : fmt(t.pro.freeUses, { n: left })}</Badge>
  const [mode, setMode] = useState<Mode>('smart')
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

/** Players with measured specs, each with its source. */
/** "junho de 2023" from "2023-06". */
const monthYear = (ym: string, lang: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang] ?? 'en-GB', { month: 'long', year: 'numeric' })

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Pro targets: searchable, ATP and WTA apart. Each says whether it was
 * measured or reported, by whom and when, with the link.
 */
function ProList({ selected, fromStrung, onPick, onStock }: { selected: string; fromStrung: boolean; onPick: (p: ProTarget) => void; onStock: (p: ProTarget) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [q, setQ] = useState('')
  const picked = PRO_TARGETS.find((p) => p.id === selected)
  const shown = PRO_TARGETS.filter((p) => fold(`${p.player} ${p.racket}`).includes(fold(q.trim())))
  const notes = t.match.pros as Record<string, string>
  return (
    <div className="space-y-3">
      <TextField label={t.match.proSearch} value={q} onChange={setQ} />
      {shown.length === 0 && <p className="text-sm text-muted">{t.match.noPros}</p>}
      {(['ATP', 'WTA'] as const).map((tour) => {
        const list = shown.filter((p) => p.tour === tour)
        if (!list.length) return null
        return (
          <div key={tour}>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted">{tour}</h3>
            <div role="radiogroup" aria-label={`${t.match.kindPro} ${tour}`} className="divide-y divide-border rounded-md border border-border">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === p.id}
                  onClick={() => onPick(p)}
                  className={cx('flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors', selected === p.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.player}</span>
                      <Badge tone={p.evidence === 'measured' ? 'accent' : 'neutral'}>{t.match.evidence[p.evidence]}</Badge>
                    </span>
                    <span className="block truncate text-muted">{p.racket}</span>
                  </span>
                  <span className="num shrink-0 text-right text-xs text-muted">
                    {fmtNum(p.weightG, 0, lang)} g · SW {fmtNum(p.swingweight, 0, lang)}
                    <span className="block">{p.strung ? t.match.strungShort : t.match.unstrungShort}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {picked && (
        <div className="space-y-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
          {notes[picked.id] && <p>{notes[picked.id]}</p>}
          <p className="text-muted">
            <span className="font-medium text-text">{t.match.evidence[picked.evidence]}:</span> {t.match.evidenceHint[picked.evidence]}
          </p>
          <p>
            <a href={picked.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              {fmt(t.match.proSource, { source: picked.source, date: monthYear(picked.date, lang) })} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </p>
          {picked.strings && <p className="num">{fmt(t.match.proStrings, { s: [picked.strings.name, picked.strings.tension].filter(Boolean).join(' · ') })}</p>}
          {picked.strung !== fromStrung && (
            <p className="font-medium">
              {fmt(t.match.converted, { from: picked.strung ? t.match.strungShort : t.match.unstrungShort, to: fromStrung ? t.match.strungShort : t.match.unstrungShort })}
            </p>
          )}
          {picked.baseRacketId && (
            <Button size="sm" icon={Play} onClick={() => onStock(picked)}>
              {t.match.fromStock}
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-muted">{t.match.proDisclaimer}</p>
    </div>
  )
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
      return o ? asPlayed(ownedConfig(o)) : null
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
  const canRun = useTryFirst()
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const pro = useStore(isPro)
  const config = useStore((s) => s.config)
  const loadConfig = useStore((s) => s.loadConfig)
  const masses = useStore((s) => s.masses)
  const customRackets = useCustomRackets()

  const [libraryId, setLibraryId] = useState(config.racketId)
  const starts = useStarts(libraryId)
  const [picked, setPicked] = useState<Source>()
  const source = picked ?? starts.fallback
  const start = source ? starts.start(source) : null
  // The player's own numbers, when they change the starting point's.
  const [edited, setEdited] = useState<Vals | null>(null)
  const [editing, setEditing] = useState(false)
  const from = edited ?? start?.vals ?? {}
  const fromStrung = start?.strung ?? false
  const racket = useRacket(start?.racketId)

  const [kind, setKind] = useState<'racket' | 'pro'>('racket')
  const [targetRacketId, setTargetRacketId] = useState<string>()
  const targetRacket = useRacket(targetRacketId)
  const [proId, setProId] = useState('')
  const [targetSrc, setTargetSrc] = useState<TargetSrc | null>(null)
  const [typed, setTyped] = useState<Vals | null>(null)
  // A target from a racket, a setup or a pro follows the starting point into
  // its state (with or without strings); numbers typed in stay as typed.
  const to = typed ?? (targetSrc ? asVals(withStrings(targetSrc.frame, targetSrc.specs, targetSrc.strung, fromStrung)) : {})

  const [allowed, setAllowed] = useState<Position[]>([...POSITIONS])
  const [maxPer, setMaxPer] = useState<number | undefined>(LEAD_MAX)
  const [res, setRes] = useState<MatchResult | null>(null)
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

  const run = () => {
    if (!canRun()) return
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
    setRes(solveTarget(base, target, { allowed, maxPerPositionG: maxPer ?? LEAD_MAX }))
  }

  const openInCalc = () => {
    if (!res || !racket) return
    if (start?.config && !edited) {
      // The setup as it was, with the lead added.
      const cfg = start.config
      const lead = { ...cfg.leadG }
      for (const p of POSITIONS) lead[p] = Math.min(LEAD_MAX, lead[p] + res.lead[p])
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
          leadG: res.lead,
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
                  pickTarget({ frame: r, specs: r, strung: false })
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
                    pickTarget({ frame: r, specs: result, strung: s.accessories.strings })
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
                pickTarget({ frame: p, specs: p, strung: p.strung })
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
          <Button variant="primary" size="lg" icon={pro ? TargetIcon : Sparkles} className="mt-4 w-full" onClick={run} disabled={allowed.length === 0}>
            {t.match.run}
          </Button>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8">{res ? <PlanCard res={res} onOpen={openInCalc} /> : null}</div>
    </div>
  )
}

function PlanCard({ res, onOpen, title }: { res: MatchResult; onOpen?: () => void; title?: string }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [sel, setSel] = useState<Position>('tip')
  const label: Record<TargetKey, [string, number, string]> = {
    weightG: [t.spec.weight, 0, 'g'],
    balanceCm: [t.spec.balance, 0, 'mm'],
    swingweight: [t.spec.swingweight, 0, ''],
    twistweight: [t.spec.twistweight, 2, ''],
  }
  return (
    <Card label={title ?? t.match.result}>
      <CardTitle action={<Badge plain tone={res.matchPct >= 95 ? 'accent' : 'neutral'}>{fmt(t.match.match, { pct: fmtNum(res.matchPct, res.matchPct === 100 ? 0 : 1, lang) })}</Badge>}>
        {title ?? t.match.result}
      </CardTitle>
      {res.unreachable.length > 0 && (
        <p className="mb-3 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
          {fmt(t.match.unreachable, { what: res.unreachable.map((k) => label[k][0]).join(', ') })}
        </p>
      )}
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
    </Card>
  )
}

interface Slot {
  key: string
  racketId?: string
  vals: Vals
  base?: Base | null
}

function Batch() {
  const canRun = useTryFirst()
  const t = useT()
  const pro = useStore(isPro)
  const lang = useStore((s) => s.lang)
  const [slots, setSlots] = useState<Slot[]>([
    { key: 'a', vals: {} },
    { key: 'b', vals: {} },
  ])
  const [res, setRes] = useState<BatchResult | null>(null)
  const [err, setErr] = useState<string>()

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
            slot={s}
            onChange={(p) => update(i, p)}
            onRemove={slots.length > 2 ? () => setSlots(slots.filter((_, j) => j !== i)) : undefined}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.length < 3 && (
          <Button icon={Plus} onClick={() => setSlots([...slots, { key: String(Date.now()), vals: {} }])}>
            {t.match.addRacket}
          </Button>
        )}
        <Button
          variant="primary"
          icon={pro ? TargetIcon : Sparkles}
          onClick={() => {
            if (!canRun()) return
            setErr(undefined)
            const bases = slots.map((s) => s.racketId && s.base)
            if (bases.some((b) => !b)) return setErr(t.racketForm.invalid)
            setRes(matchRackets(bases as Base[], { maxPerPositionG: LEAD_MAX }))
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
            <CardTitle action={<Badge plain tone="accent">{fmt(t.match.match, { pct: fmtNum(res.matchPct, 1, lang) })}</Badge>}>{t.match.commonTarget}</CardTitle>
            <dl className="num grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label={t.spec.weight} value={`${fmtNum(res.target.weightG, 0, lang)} g`} />
              <Stat label={t.spec.balance} value={`${fmtNum((res.target.balanceCm ?? 0) * 10, 0, lang)} mm`} />
              <Stat label={t.spec.swingweight} value={fmtNum(res.target.swingweight, 0, lang)} />
              {res.target.twistweight !== undefined && <Stat label={t.spec.twistweight} value={fmtNum(res.target.twistweight, 2, lang)} />}
            </dl>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {res.plans.map((p, i) => (
              <PlanCard key={slots[i].key} res={p} title={fmt(t.match.racketN, { n: i + 1 })} />
            ))}
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

function BatchSlot({ n, slot, onChange, onRemove }: { n: number; slot: Slot; onChange: (s: Partial<Slot>) => void; onRemove?: () => void }) {
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
        {fmt(t.match.racketN, { n })}
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

