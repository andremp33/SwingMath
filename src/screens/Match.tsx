import { Calculator, Plus, Sparkles, Target as TargetIcon, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchRackets, solveTarget, type BatchResult, type MatchResult, type Target, type TargetKey } from '../domain/match'
import type { Base } from '../domain/physics'
import { POSITIONS, type Position, type Racket } from '../domain/types'
import { findRacket } from '../data/db'
import { useComputed, useCustomRackets, useRacket, useSetups } from '../data/hooks'
import { compute } from '../domain/physics'
import { FREE_PRO_RUNS, isPro, useStore } from '../data/store'
import { PRO_TARGETS } from '../data/pros'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned, racketLabel } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, NumberField, PageTitle, Segmented, Select } from '../ui/basics'
import { LEAD_MAX, RacketDiagram } from '../ui/lead'
import { RacketPicker } from '../ui/RacketPicker'
import { usePaywall } from './Pro'

type Mode = 'smart' | 'batch'

/** Pro tools work a few times before buying, so people can try first. */
function useTryFirst() {
  const pro = useStore(isPro)
  const used = useStore((s) => s.freeRunsUsed)
  const spend = useStore((s) => s.spendFreeRun)
  const paywall = usePaywall()
  const t = useT()
  return () => {
    if (pro) return true
    if (used >= FREE_PRO_RUNS) {
      paywall(fmt(t.pro.tryFree, { n: used, max: FREE_PRO_RUNS }))
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
  const badge = !pro && <Badge tone="pro">{left > 0 ? fmt(t.pro.freeLeft, { n: left }) : 'Pro'}</Badge>
  const [mode, setMode] = useState<Mode>('smart')
  return (
    <>
      <PageTitle>{t.match.title}</PageTitle>
      <div className="mb-4 max-w-md">
        <Segmented
          label={t.match.title}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'smart', label: t.match.smart, badge },
            { value: 'batch', label: t.match.batch, badge },
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
  weightG: r.weightG,
  balanceMm: Math.round(r.balanceCm * 100) / 10,
  swingweight: r.swingweight,
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

function Smart() {
  const canRun = useTryFirst()
  const t = useT()
  const nav = useNavigate()
  const pro = useStore(isPro)
  const config = useStore((s) => s.config)
  const loadConfig = useStore((s) => s.loadConfig)
  const calcRacket = useRacket(config.racketId)
  const calc = useComputed(config, calcRacket)
  const savedSetups = useSetups()
  const customRackets = useCustomRackets()
  const masses = useStore((s) => s.masses)

  const [racketId, setRacketId] = useState(config.racketId)
  const racket = useRacket(racketId)
  const [from, setFrom] = useState<Vals>({})
  const [fromCalc, setFromCalc] = useState(false)
  const [targetRacketId, setTargetRacketId] = useState<string>()
  const targetRacket = useRacket(targetRacketId)
  const [to, setTo] = useState<Vals>({})
  const [proId, setProId] = useState('')
  const pro_ = PRO_TARGETS.find((p) => p.id === proId)
  const [allowed, setAllowed] = useState<Position[]>([...POSITIONS])
  const [maxPer, setMaxPer] = useState<number | undefined>(LEAD_MAX)
  const [res, setRes] = useState<MatchResult | null>(null)
  const [err, setErr] = useState<string>()

  // First fill from the chosen racket, once it is known.
  const [filledFor, setFilledFor] = useState<string>()
  if (racket && filledFor !== racket.id) {
    setFilledFor(racket.id)
    setFrom(fromRacket(racket))
    setFromCalc(false)
    setRes(null)
  }

  const useCalc = () => {
    if (!calc || !calcRacket) return
    const r = calc.result
    setRacketId(calcRacket.id)
    setFilledFor(calcRacket.id)
    setFrom({
      weightG: Math.round(r.weightG * 10) / 10,
      balanceMm: Math.round(r.balanceCm * 100) / 10,
      swingweight: Math.round(r.swingweight * 10) / 10,
      twistweight: r.twistweightEstimated || r.twistweight === undefined ? undefined : Math.round(r.twistweight * 100) / 100,
    })
    setFromCalc(true)
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
    if (fromCalc) {
      const lead = { ...config.leadG }
      for (const p of POSITIONS) lead[p] = Math.min(LEAD_MAX, lead[p] + res.lead[p])
      loadConfig({ ...config, leadG: lead }, null)
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
          accessories: { strings: false, leatherGrip: false, overgrip: false, dampener: false },
          leadG: res.lead,
        },
        null,
      )
    }
    nav('/')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="space-y-4">
        <p className="text-sm text-muted">{t.match.smartIntro}</p>
        <Card className="space-y-4" label={t.match.from}>
          <CardTitle action={calc && <Button size="sm" icon={Calculator} onClick={useCalc}>{t.match.useCalc}</Button>}>{t.match.from}</CardTitle>
          <RacketPicker label={t.calc.racket} value={racket} onChange={(r) => setRacketId(r.id)} />
          <SpecFields v={from} onChange={(v) => { setFrom(v); setFromCalc(false); setRes(null) }} required />
        </Card>
        <Card className="space-y-4" label={t.match.to}>
          <CardTitle>{t.match.to}</CardTitle>
          {savedSetups && savedSetups.length > 0 && (
            <Select
              label={t.match.targetSetup}
              value=""
              onChange={(id) => {
                const s = savedSetups.find((x) => x.id === id)
                const r = s && findRacket(s.racketId, customRackets)
                if (!s || !r) return
                const { result } = compute({ spec: r, ...s, masses })
                setTo({
                  weightG: Math.round(result.weightG * 10) / 10,
                  balanceMm: Math.round(result.balanceCm * 100) / 10,
                  swingweight: Math.round(result.swingweight * 10) / 10,
                  twistweight: result.twistweightEstimated || result.twistweight === undefined ? undefined : Math.round(result.twistweight * 100) / 100,
                })
                setProId('')
                setRes(null)
              }}
              options={[{ value: '', label: t.match.pickSetup }, ...savedSetups.map((s) => ({ value: s.id, label: s.name }))]}
            />
          )}
          <Select
            label={t.match.targetPro}
            value={proId}
            onChange={(id) => {
              setProId(id)
              const p = PRO_TARGETS.find((x) => x.id === id)
              if (!p) return
              setTo({ weightG: p.weightG, balanceMm: Math.round(p.balanceCm * 100) / 10, swingweight: p.swingweight })
              setRes(null)
            }}
            options={[{ value: '', label: t.match.pickPro }, ...PRO_TARGETS.map((p) => ({ value: p.id, label: `${p.player} · ${p.racket}` }))]}
          />
          {pro_ && (
            <div className="space-y-1 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
              <p>{t.match.pros[pro_.id]}</p>
              <p className="font-medium">{pro_.strung ? t.match.proStrung : t.match.proUnstrung}</p>
              <a href={pro_.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline underline-offset-2">
                {fmt(t.match.proSource, { source: pro_.source })}
              </a>
            </div>
          )}
          <RacketPicker
            label={t.match.targetRacket}
            value={targetRacket}
            onChange={(r) => {
              setTargetRacketId(r.id)
              setProId('')
              setTo(fromRacket(r))
              setRes(null)
            }}
          />
          <SpecFields v={to} onChange={(v) => { setTo(v); setProId(''); setRes(null) }} />
        </Card>
        <Card>
          <CardTitle>{t.match.positions}</CardTitle>
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
        </Card>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <Button variant="primary" size="lg" icon={pro ? TargetIcon : Sparkles} className="w-full" onClick={run} disabled={allowed.length === 0}>
          {t.match.run}
        </Button>
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
    weightG: [t.spec.weight, 1, 'g'],
    balanceCm: [t.spec.balance, 1, 'mm'],
    swingweight: [t.spec.swingweight, 1, ''],
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
      <p className="text-sm text-muted">{t.match.batchIntro}</p>
      <p className="text-xs text-muted">{t.match.sameRacketTwice}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <Stat label={t.spec.weight} value={`${fmtNum(res.target.weightG, 1, lang)} g`} />
              <Stat label={t.spec.balance} value={`${fmtNum((res.target.balanceCm ?? 0) * 10, 1, lang)} mm`} />
              <Stat label={t.spec.swingweight} value={fmtNum(res.target.swingweight, 1, lang)} />
              {res.target.twistweight !== undefined && <Stat label={t.spec.twistweight} value={fmtNum(res.target.twistweight, 2, lang)} />}
            </dl>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

