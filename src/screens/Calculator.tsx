import { ChevronUp, CircleAlert, CircleCheck, Info, Plus, RotateCcw, Ruler, Save, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { feel, FEEL_KEYS, type Feel } from '../domain/feel'
import { geometry } from '../domain/physics'
import { emptyLead, POSITIONS, type Position, type Setup, type Specs } from '../domain/types'
import { saveSetup, uid } from '../data/db'
import { useComputed, useRacket, useSetups } from '../data/hooks'
import { FREE_SETUP_LIMIT, isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, NumberField, PageTitle, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { ExtraControl, LeadControl, RacketDiagram } from '../ui/lead'
import { Sheet, useToast } from '../ui/overlay'
import { RacketPicker } from '../ui/RacketPicker'
import { FeelRings, SpecStrip, SpecTable, useSpecRows } from '../ui/specs'
import { ComfortCard, GripCard, StringsCard, SweetSpotCard } from './CalcExtras'
import { CommunityCard } from './Community'
import { InfoSheet } from './InfoSheet'
import { usePaywall } from './Pro'
import { InfoTip } from '../ui/disclosure'
import { RacketSources } from './RacketSources'

export function Calculator() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const masses = useStore((s) => s.masses)
  const setConfig = useStore((s) => s.setConfig)
  const setLead = useStore((s) => s.setLead)
  const resetConfig = useStore((s) => s.resetConfig)
  const loadedSetupId = useStore((s) => s.loadedSetupId)
  const racket = useRacket(config.racketId)
  const computed = useComputed(config, racket)
  // The same setup without lead: what the feel bar compares against.
  const noLeadConfig = useMemo(() => ({ ...config, leadG: emptyLead(), extra: [] }), [config])
  const noLead = useComputed(noLeadConfig, racket)
  const setups = useSetups()
  const loaded = setups?.find((s) => s.id === loadedSetupId)
  const [selected, setSelected] = useState<Position | string>('tip')
  const [addOpen, setAddOpen] = useState(false)
  const updateExtra = useStore((s) => s.updateExtra)
  const removeExtra = useStore((s) => s.removeExtra)
  const addExtra = useStore((s) => s.addExtra)
  const [infoOpen, setInfoOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const baseRows = useSpecRows(computed?.base ?? emptySpecs, undefined, { recoil: false })
  const resultRows = useSpecRows(computed?.result ?? emptySpecs, computed?.base)
  const [barOpen, setBarOpen] = useState(() => readOpen(BAR_KEY))
  const toggleBar = () => {
    setBarOpen(!barOpen)
    writeOpen(BAR_KEY, !barOpen)
  }

  if (!racket || !computed) {
    return (
      <>
        <PageTitle>{t.calc.title}</PageTitle>
        <RacketPicker label={t.calc.racket} value={undefined} onChange={(r) => setConfig({ racketId: r.id })} />
      </>
    )
  }

  const f = feel(computed.result, racket.headSizeSqIn, racket.ra)
  const extra = config.extra ?? []
  const totalLead = POSITIONS.reduce((a, p) => a + config.leadG[p], 0) + extra.reduce((a, e) => a + e.grams, 0)
  const geo = racket ? geometry(racket.lengthCm, racket.headSizeSqIn) : undefined
  const focusSlider = (id: string) => {
    setSelected(id)
    document.getElementById(`lead-${id}`)?.querySelector('input')?.focus({ preventScroll: true })
  }
  const { base, result } = computed

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" icon={Info} onClick={() => setInfoOpen(true)} aria-label={t.info.title}>
              <span className="hidden sm:inline">{t.info.title}</span>
            </Button>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetConfig} aria-label={t.calc.clear}>
              <span className="hidden sm:inline">{t.calc.clear}</span>
            </Button>
          </div>
        }
      >
        {t.calc.title}
      </PageTitle>

      {loaded && (
        <p className="-mt-2 mb-4 text-sm text-muted">
          {fmt(t.calc.fromSetup, { name: loaded.name })}
        </p>
      )}

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="contents xl:block xl:space-y-4">
          <Card className="order-1 xl:order-none">
            <div className="space-y-4">
              <RacketPicker label={t.calc.racket} value={racket} onChange={(r) => setConfig({ racketId: r.id })} />
              <Segmented
                label={t.calc.base}
                value={config.baseMode}
                onChange={(baseMode) => setConfig({ baseMode })}
                options={[
                  { value: 'reference', label: t.calc.baseReference },
                  { value: 'measured', label: t.calc.baseMeasured },
                ]}
              />
              {config.baseMode === 'reference' ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      {t.calc.reference}
                      {racket.isStock && (
                        <InfoTip title={t.sources.title}>
                          <RacketSources racket={racket} />
                        </InfoTip>
                      )}
                    </span>
                    {racket.isStock ? <Badge>{t.library.stock}</Badge> : <Badge tone="accent">{t.library.custom}</Badge>}
                  </div>
                  <div className="xl:hidden">
                    <SpecStrip rows={baseRows} />
                  </div>
                  <div className="hidden xl:block">
                    <SpecTable rows={baseRows} showDelta={false} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">{t.calc.measuredHint}</p>
                  <Link to="/medir" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text underline-offset-2 hover:underline">
                    <Ruler className="size-4" aria-hidden /> {t.measure.open}
                  </Link>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label={t.spec.weight}
                      unit="g"
                      min={150}
                      max={450}
                      placeholder={fmtNum(racket.weightG, 1, lang)}
                      value={config.measured.weightG}
                      onChange={(v) => setConfig({ measured: { ...config.measured, weightG: v } })}
                    />
                    <NumberField
                      label={t.spec.balance}
                      unit="mm"
                      min={250}
                      max={400}
                      placeholder={fmtNum(racket.balanceCm * 10, 1, lang)}
                      value={config.measured.balanceCm === undefined ? undefined : config.measured.balanceCm * 10}
                      onChange={(v) => setConfig({ measured: { ...config.measured, balanceCm: v === undefined ? undefined : v / 10 } })}
                    />
                    <NumberField
                      label={t.spec.swingweight}
                      min={150}
                      max={450}
                      placeholder={fmtNum(racket.swingweight, 1, lang)}
                      value={config.measured.swingweight}
                      onChange={(v) => setConfig({ measured: { ...config.measured, swingweight: v } })}
                    />
                    <NumberField
                      label={t.spec.twistweight}
                      hint={t.common.optional}
                      min={5}
                      max={25}
                      placeholder={racket.twistweight ? fmtNum(racket.twistweight, 1, lang) : ''}
                      value={config.measured.twistweight}
                      onChange={(v) => setConfig({ measured: { ...config.measured, twistweight: v } })}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="order-5 xl:order-none">
            <CardTitle>{t.acc.title}</CardTitle>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {(['strings', 'overgrip', 'leatherGrip', 'dampener'] as const).map((k) => (
                <Toggle
                  key={k}
                  label={t.acc[k]}
                  hint={`+${fmtNum(masses[k], 0, lang)} g`}
                  checked={config.accessories[k]}
                  onChange={(v) => setConfig({ accessories: { ...config.accessories, [k]: v } })}
                />
              ))}
            </div>
          </Card>

          <Card className="order-2 xl:order-none">
            <CardTitle action={<span className="text-sm text-muted">{t.calc.totalLead}: <span className="readout text-text">{fmtNum(totalLead, 1, lang)} g</span></span>}>
              {t.calc.lead}
            </CardTitle>
            <p className="mb-3 text-sm text-muted">{t.calc.leadHint}</p>
            <div className="@container"><div className="grid grid-cols-1 items-center gap-4 @lg:grid-cols-[150px_minmax(0,1fr)]">
              <RacketDiagram
                sweetSpot={{ x: result.sweetSpotCm, g: geo!, from: noLead?.result.sweetSpotCm }}
                geometry={geo}
                pattern={racket.pattern}
                lead={config.leadG}
                extra={extra}
                selected={selected}
                onSelect={focusSlider}
                onSelectExtra={focusSlider}
              />
              <div className="space-y-1">
                {POSITIONS.map((p) => (
                  <LeadControl key={p} position={p} value={config.leadG[p]} onChange={(g) => setLead(p, g)} selected={selected === p} onFocus={() => setSelected(p)} />
                ))}
              </div>
            </div></div>

            <div className="mt-4 border-t border-border pt-4" role="group" aria-labelledby="custom-title">
              <div className="flex items-center justify-between gap-2">
                <h3 id="custom-title" className="text-sm text-muted">
                  {t.custom.title}
                </h3>
                <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)} disabled={extra.length >= 12}>
                  {t.custom.add}
                </Button>
              </div>
              {extra.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t.custom.hint}</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {extra.map((e) => (
                    <ExtraControl
                      key={e.id}
                      item={e}
                      selected={selected === e.id}
                      onFocus={() => setSelected(e.id)}
                      onChange={(grams) => updateExtra(e.id, { grams })}
                      onRemove={() => removeExtra(e.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
          <div className="order-2 xl:order-none">
            <SweetSpotCard
              racket={racket}
              result={result}
              noLead={noLead?.result ?? result}
              geo={geo!}
              onAdd={(e) => {
                addExtra(e)
                setTimeout(() => focusSlider(e.id), 50)
              }}
            />
          </div>
          <div className="order-6 xl:order-none"><StringsCard racket={racket} /></div>
          <div className="order-7 xl:order-none"><GripCard /></div>
          <div className="order-11 xl:order-none"><CommunityCard racket={racket} /></div>
        </div>

        <div className="contents xl:sticky xl:top-8 xl:block xl:space-y-4">
          <Card label={t.calc.result} className="order-3 xl:order-none">
            <CardTitle>{t.calc.result}</CardTitle>
            <SpecTable rows={resultRows} />
          </Card>
          <Card className="order-4 xl:order-none">
            <CardTitle info={<InfoTip title={t.calc.feel}>{t.calc.feelHint}</InfoTip>}>{t.calc.feel}</CardTitle>
            <FeelRings feel={f} />
          </Card>
          <div className="order-8 xl:order-none"><ComfortCard racket={racket} specs={result} /></div>
          <div className="order-9 xl:order-none"><SaveButtons loaded={loaded} onSaveNew={() => setSaveOpen(true)} /></div>
          <div className="order-10 xl:order-none"><VerifyCard predicted={result} /></div>
        </div>
      </div>

      {/* Phones: the result (and, opened, the feel) follows you while you move the sliders. */}
      <ResultBar result={result} base={base} feel={f} feelBase={feel(noLead?.result ?? result, racket.headSizeSqIn, racket.ra)} open={barOpen} onToggle={toggleBar} />
      <div className={cx('lg:hidden', barOpen ? 'h-44' : 'h-12')} />

      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
      <AddPositionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(id) => setTimeout(() => focusSlider(id), 50)}
      />
      <SaveSetupSheet open={saveOpen} onClose={() => setSaveOpen(false)} count={setups?.length ?? 0} />
    </>
  )
}

const emptySpecs = { weightG: 0, balanceCm: 0, ptsHL: 0, swingweight: 0, recoilWeight: 0, sweetSpotCm: 0 }

/** Tolerance of a kitchen scale and a swingweight machine. */
const VERIFY_TOL = { weightG: 1.5, balanceMm: 2, swingweight: 2.5 }

/** Lets the player check the prediction against what they measure. */
function VerifyCard({ predicted }: { predicted: Specs }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [open, setOpen] = useState(false)
  const [m, setM] = useState<{ weightG?: number; balanceMm?: number; swingweight?: number }>({})
  const rows = [
    { k: 'weightG' as const, label: t.spec.weight, unit: 'g', pred: predicted.weightG, min: 150, max: 500 },
    { k: 'balanceMm' as const, label: t.spec.balance, unit: 'mm', pred: predicted.balanceCm * 10, min: 250, max: 400 },
    { k: 'swingweight' as const, label: t.spec.swingweight, unit: '', pred: predicted.swingweight, min: 150, max: 450 },
  ]
  const filled = rows.filter((r) => m[r.k] !== undefined)
  const ok = filled.every((r) => Math.abs(m[r.k]! - r.pred) <= VERIFY_TOL[r.k])
  const setConfig = useStore((s) => s.setConfig)
  const toast = useToast()
  const useAsBase = () => {
    setConfig({
      baseMode: 'measured',
      measured: { weightG: m.weightG, balanceCm: m.balanceMm === undefined ? undefined : m.balanceMm / 10, swingweight: m.swingweight },
      accessories: { strings: false, leatherGrip: false, overgrip: false, dampener: false },
      leadG: { tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 },
      extra: [],
    })
    setM({})
    setOpen(false)
    toast(t.calc.usedAsBase)
  }

  if (!open)
    return (
      <Button variant="ghost" icon={Scale} className="w-full" onClick={() => setOpen(true)}>
        {t.calc.verify}
      </Button>
    )
  return (
    <Card label={t.calc.verify}>
      <CardTitle>{t.calc.verify}</CardTitle>
      <p className="mb-3 text-sm text-muted">{t.calc.verifyHint}</p>
      <div className="space-y-3">
        {rows.map((r) => {
          const v = m[r.k]
          const d = v === undefined ? undefined : v - r.pred
          return (
            <div key={r.k} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <NumberField label={r.label} unit={r.unit} min={r.min} max={r.max} placeholder={fmtNum(r.pred, 1, lang)} value={v} onChange={(x) => setM({ ...m, [r.k]: x })} />
              <div className="num pb-2.5 text-right text-sm">
                <div className="text-xs text-muted">{t.calc.predicted}</div>
                <div className="font-semibold">
                  {fmtNum(r.pred, 1, lang)}
                  {d !== undefined && (
                    <span className={cx('ml-2 text-xs', Math.abs(d) <= VERIFY_TOL[r.k] ? 'text-success' : 'text-warning')}>{fmtSigned(d, 1, lang)}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {filled.length > 0 && (
        <p role="status" className={cx('mt-4 flex gap-2 text-sm', ok ? 'text-success' : 'text-warning')}>
          {ok ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {ok ? t.calc.verifyOk : t.calc.verifyOff}
        </p>
      )}
      {filled.length > 0 && (
        <Button className="mt-4 w-full" onClick={useAsBase}>
          {t.calc.useAsBase}
        </Button>
      )}
    </Card>
  )
}

const BAR_KEY = 'swingmath-open:result-bar'
const readOpen = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const writeOpen = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? '1' : '0')
  } catch {
    // Private mode: it just won't be remembered.
  }
}

/** The bar above the tabs: the four numbers; a tap opens the feel above
 *  them, with how much the lead moved each one. */
function ResultBar({ result, base, feel: f, feelBase, open, onToggle }: { result: Specs; base: Specs; feel: Feel; feelBase: Feel; open: boolean; onToggle: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <div className="result-bar fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
      {open && (
        <ul id="result-bar-feel" aria-label={t.calc.feel} className="mx-auto grid max-w-lg grid-cols-3 gap-x-2 gap-y-2 border-b border-border pb-2 pt-3">
          {FEEL_KEYS.map((k) => (
            <MiniRing key={k} label={t.feel[k]} value={f[k]} delta={f[k] - feelBase[k]} color={`var(--c-${k})`} lang={lang} />
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="result-bar-feel"
        aria-label={t.calc.feel}
        onClick={onToggle}
        className="num mx-auto flex w-full max-w-lg items-center py-2 text-center text-xs"
      >
        <Mini label={t.spec.weight} value={fmtNum(result.weightG, 1, lang)} delta={result.weightG - base.weightG} lang={lang} />
        <Mini label={t.spec.balance} value={fmtNum(result.balanceCm * 10, 1, lang)} delta={(result.balanceCm - base.balanceCm) * 10} lang={lang} />
        <Mini label="SW" value={fmtNum(result.swingweight, 1, lang)} delta={result.swingweight - base.swingweight} lang={lang} />
        <Mini label="TW" value={fmtNum(result.twistweight, 2, lang)} delta={(result.twistweight ?? 0) - (base.twistweight ?? 0)} digits={2} lang={lang} />
        <ChevronUp className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
    </div>
  )
}

function MiniRing({ label, value, delta, color, lang }: { label: string; value: number; delta: number; color: string; lang: string }) {
  const R = 15
  const C = 2 * Math.PI * R
  const d = Math.round(delta)
  return (
    <li className="flex min-w-0 flex-col items-center gap-0.5">
      <div className="flex items-center">
        <span className="w-7" aria-hidden />
        <div className="relative size-10">
          <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r={R} fill="none" stroke="var(--c-border)" strokeWidth="3.5" />
            <circle
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - value / 100)}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
          </svg>
          <span className="num absolute inset-0 flex items-center justify-center text-xs font-semibold">{Math.round(value)}</span>
        </div>
        <span className={cx('num w-7 pl-1 text-[11px]', d === 0 ? 'text-muted' : 'font-semibold text-text')}>{d === 0 ? '·' : fmtSigned(d, 0, lang)}</span>
      </div>
      <span className="max-w-full truncate text-[11px] text-muted">{label}</span>
    </li>
  )
}

function Mini({ label, value, delta, digits = 1, lang }: { label: string; value: string; delta: number; digits?: number; lang: string }) {
  const d = Math.round(delta * 10 ** digits) / 10 ** digits
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-muted">{label}</div>
      <div className="readout text-sm">{value}</div>
      <div className="num text-[11px] text-muted">{d === 0 ? '·' : fmtSigned(delta, digits, lang)}</div>
    </div>
  )
}

function SaveButtons({ loaded, onSaveNew }: { loaded: Setup | undefined; onSaveNew: () => void }) {
  const t = useT()
  const toast = useToast()
  const config = useStore((s) => s.config)
  if (!loaded)
    return (
      <Button variant="primary" size="lg" icon={Save} className="w-full" onClick={onSaveNew}>
        {t.calc.saveSetup}
      </Button>
    )
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="primary"
        size="lg"
        icon={Save}
        className="min-w-0 whitespace-normal text-sm leading-tight"
        onClick={async () => {
          await saveSetup({ ...loaded, ...structuredClone(config), updatedAt: Date.now() })
          toast(t.calc.updated)
        }}
      >
        {t.calc.updateSetup}
      </Button>
      <Button size="lg" className="min-w-0 whitespace-normal text-sm leading-tight" onClick={onSaveNew}>
        {t.calc.saveAsNew}
      </Button>
    </div>
  )
}

function SaveSetupSheet({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const t = useT()
  const toast = useToast()
  const config = useStore((s) => s.config)
  const loadConfig = useStore((s) => s.loadConfig)
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const [name, setName] = useState('')
  const fallback = fmt(t.setups.defaultName, { n: count + 1 })

  const save = async () => {
    if (!pro && count >= FREE_SETUP_LIMIT) {
      onClose()
      paywall(fmt(t.setups.limit, { n: FREE_SETUP_LIMIT }))
      return
    }
    const now = Date.now()
    const s: Setup = {
      ...structuredClone(config),
      id: uid(),
      name: name.trim() || fallback,
      favourite: false,
      ratings: {},
      createdAt: now,
      updatedAt: now,
    }
    await saveSetup(s)
    loadConfig(config, s.id)
    setName('')
    onClose()
    toast(t.common.saved)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.calc.saveSetup}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField label={t.setups.name} value={name} onChange={setName} placeholder={fallback} maxLength={60} autoFocus />
      </form>
    </Sheet>
  )
}


const HOURS = Array.from({ length: 23 }, (_, i) => (i + 1) / 2) // 0.5 … 11.5

/** Pick where a custom strip goes: an hour on the hoop, or a point on the shaft. */
function AddPositionSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const t = useT()
  const addExtra = useStore((s) => s.addExtra)
  const [kind, setKind] = useState<'hoop' | 'shaft'>('hoop')
  const [hour, setHour] = useState('11')
  const [sides, setSides] = useState<'1' | '2'>('2')
  const [cm, setCm] = useState<number | undefined>(25)
  const add = () => {
    const id = uid()
    addExtra({ id, kind, hour: kind === 'hoop' ? Number(hour) : undefined, cm: kind === 'shaft' ? cm : undefined, sides: kind === 'hoop' ? (Number(sides) as 1 | 2) : 1, grams: 1 })
    onClose()
    onAdded(id)
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.custom.add}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Plus} onClick={add} disabled={kind === 'shaft' && cm === undefined}>
            {t.custom.add}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          label={t.custom.where}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'hoop', label: t.custom.hoop },
            { value: 'shaft', label: t.custom.shaft },
          ]}
        />
        {kind === 'hoop' ? (
          <>
            <Select label={t.custom.hourLabel} value={hour} onChange={setHour} options={HOURS.map((h) => ({ value: String(h), label: t.custom.hour(h) }))} />
            <Segmented
              label={t.custom.sides}
              value={sides}
              onChange={setSides}
              options={[
                { value: '2', label: t.custom.both },
                { value: '1', label: t.custom.one },
              ]}
            />
          </>
        ) : (
          <NumberField label={t.custom.cm} unit="cm" min={1} max={60} value={cm} onChange={setCm} />
        )}
      </div>
    </Sheet>
  )
}
