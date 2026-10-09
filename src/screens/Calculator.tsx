import { CircleAlert, CircleCheck, Info, Plus, RotateCcw, Ruler, Save, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { feel } from '../domain/feel'
import { geometry } from '../domain/physics'
import { POSITIONS, type Position, type Setup, type Specs } from '../domain/types'
import { saveSetup, uid } from '../data/db'
import { useComputed, useRacket, useSetups } from '../data/hooks'
import { FREE_SETUP_LIMIT, isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, NumberField, PageTitle, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { ExtraControl, LeadControl, RacketDiagram } from '../ui/lead'
import { Sheet, useToast } from '../ui/overlay'
import { RacketPicker } from '../ui/RacketPicker'
import { FeelRings, SpecTable, useSpecRows } from '../ui/specs'
import { ComfortCard, GripCard, StringsCard } from './CalcExtras'
import { CommunityCard } from './Community'
import { InfoSheet } from './InfoSheet'
import { usePaywall } from './Pro'

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
  const setups = useSetups()
  const loaded = setups?.find((s) => s.id === loadedSetupId)
  const [selected, setSelected] = useState<Position | string>('tip')
  const [addOpen, setAddOpen] = useState(false)
  const updateExtra = useStore((s) => s.updateExtra)
  const removeExtra = useStore((s) => s.removeExtra)
  const [infoOpen, setInfoOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const baseRows = useSpecRows(computed?.base ?? emptySpecs, undefined, { recoil: false })
  const resultRows = useSpecRows(computed?.result ?? emptySpecs, computed?.base)

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
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetConfig}>
              {t.calc.clear}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-4">
          <Card>
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
                    <span className="text-sm text-muted">{t.calc.reference}</span>
                    {racket.isStock ? <Badge>{t.library.stock}</Badge> : <Badge tone="accent">{t.library.custom}</Badge>}
                  </div>
                  <SpecTable rows={baseRows} showDelta={false} />
                  {racket.isStock && racket.source?.startsWith('http') && (
                    <p className="mt-2 text-xs text-muted">
                      {t.calc.sourceNote}{' '}
                      <a href={racket.source} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline underline-offset-2">
                        {t.calc.sourceLink}
                      </a>
                    </p>
                  )}
                  {racket.isStock && racket.approxWeight && <p className="mt-1 text-xs text-muted">{t.calc.approxNote}</p>}
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

          <Card>
            <CardTitle>{t.acc.title}</CardTitle>
            <div className="grid gap-x-6 sm:grid-cols-2">
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

          <Card>
            <CardTitle action={<span className="text-sm text-muted">{t.calc.totalLead}: <span className="readout text-text">{fmtNum(totalLead, 1, lang)} g</span></span>}>
              {t.calc.lead}
            </CardTitle>
            <p className="mb-3 text-sm text-muted">{t.calc.leadHint}</p>
            <div className="@container"><div className="grid items-center gap-4 @lg:grid-cols-[150px_minmax(0,1fr)]">
              <RacketDiagram
                sweetSpot={{ x: result.sweetSpotCm, g: geo! }}
                geometry={geo}
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
          <StringsCard racket={racket} />
          <GripCard />
          <CommunityCard racket={racket} />
        </div>

        <div className="space-y-4 xl:sticky xl:top-8">
          <Card label={t.calc.result}>
            <CardTitle>{t.calc.result}</CardTitle>
            <SpecTable rows={resultRows} />
          </Card>
          <Card>
            <CardTitle>{t.calc.feel}</CardTitle>
            <FeelRings feel={f} />
            <p className="mt-3 text-xs text-muted">{t.calc.feelHint}</p>
          </Card>
          <ComfortCard racket={racket} specs={result} />
          <SaveButtons loaded={loaded} onSaveNew={() => setSaveOpen(true)} />
          <VerifyCard predicted={result} />
        </div>
      </div>

      {/* Phones: the result follows you while you move the sliders. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur lg:hidden" aria-hidden>
        <div className="num mx-auto flex max-w-lg justify-between text-center text-xs">
          <Mini label={t.spec.weight} value={fmtNum(result.weightG, 1, lang)} delta={result.weightG - base.weightG} lang={lang} />
          <Mini label={t.spec.balance} value={fmtNum(result.balanceCm * 10, 1, lang)} delta={(result.balanceCm - base.balanceCm) * 10} lang={lang} />
          <Mini label="SW" value={fmtNum(result.swingweight, 1, lang)} delta={result.swingweight - base.swingweight} lang={lang} />
          <Mini label="TW" value={fmtNum(result.twistweight, 2, lang)} delta={(result.twistweight ?? 0) - (base.twistweight ?? 0)} digits={2} lang={lang} />
        </div>
      </div>
      <div className="h-12 lg:hidden" />

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
    <div className="flex gap-2">
      <Button
        variant="primary"
        size="lg"
        icon={Save}
        className="flex-1"
        onClick={async () => {
          await saveSetup({ ...loaded, ...structuredClone(config), updatedAt: Date.now() })
          toast(t.calc.updated)
        }}
      >
        {t.calc.updateSetup}
      </Button>
      <Button size="lg" onClick={onSaveNew}>
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
