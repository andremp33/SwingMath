import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Info, Plus, RotateCcw, Ruler, Save, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { geometry } from '../domain/physics'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { emptyLead, POSITIONS, type Position, type Racket, type Setup, type Specs } from '../domain/types'
import { saveOwned, saveSetup, saveStringing, uid } from '../data/db'
import { useComputed, useOwned, useRacket, useSetups } from '../data/hooks'
import { FREE_SETUP_LIMIT, isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum, fmtSigned, LOCALE } from '../lib/format'
import { Badge, Button, Card, CardTitle, ChoiceChips, cx, NumberField, PageTitle, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { ExtraControl, LeadControl, RacketDiagram } from '../ui/lead'
import { Sheet, useToast } from '../ui/overlay'
import { MyRacketsRow } from '../ui/MyRackets'
import { RacketPicker } from '../ui/RacketPicker'
import { FeelRings, SpecStrip, SpecTable, useSpecRows } from '../ui/specs'
import { ComfortCard, GripCard, StringsCard, SweetSpotCard } from './CalcExtras'
import { CommunityCard, CommunityLink } from './Community'
import { InfoSheet } from './InfoSheet'
import { usePaywall } from './Pro'
import { InfoTip } from '../ui/disclosure'
import { RacketSources } from './RacketSources'
import { racketFeel, reviewOf } from '../data/racketFeel'
import { FEEL_KEYS, type Feel } from '../domain/feel'
import { suggestSetupName } from '../lib/setupName'

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

  const [accOpen, setAccOpen] = useState(false)
  const playing = noLead?.result ?? computed?.base
  const baseRows = useSpecRows(playing ?? emptySpecs, undefined, { recoil: false })
  const resultRows = useSpecRows(computed?.result ?? emptySpecs, playing)
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

  const f = racketFeel(racket, computed.result, config.strings, masses)
  const extra = config.extra ?? []
  const totalLead = POSITIONS.reduce((a, p) => a + config.leadG[p], 0) + extra.reduce((a, e) => a + e.grams, 0)
  const geo = racket ? geometry(racket.lengthCm, racket.headSizeSqIn) : undefined
  const focusSlider = (id: string) => {
    setSelected(id)
    document.getElementById(`lead-${id}`)?.querySelector('input')?.focus({ preventScroll: true })
  }
  const { base, result } = computed
  const play = noLead?.result ?? base
  const ACC = ['strings', 'overgrip', 'leatherGrip', 'dampener'] as const
  const on = ACC.filter((k) => config.accessories[k])
  const accList = new Intl.ListFormat(LOCALE[lang] ?? 'en-GB', { type: 'conjunction' }).format(on.map((k, i) => (i === 0 ? t.acc[k] : t.acc[k].toLowerCase())))
  const accSummary = on.length ? fmt(t.calc.accWith, { list: accList.charAt(0).toLowerCase() + accList.slice(1) }) : t.calc.accNone
  const catalog = config.baseMode === 'reference' && racket.isStock

  return (
    <>
      <PageTitle
        subtitle={loaded && fmt(t.calc.fromSetup, { name: loaded.name })}
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


      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="contents xl:block xl:space-y-4">
          <Card className="order-1 border-t-0 pt-0 xl:order-none">
            <div className="space-y-4">
              <div>
                <RacketPicker label={t.calc.racket} value={racket} onChange={(r) => setConfig({ racketId: r.id })} />
                <CommunityLink racket={racket} />
              </div>
              <MyRacketsRow />
              {config.baseMode === 'reference' ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      {t.calc.playing}
                      <InfoTip title={t.calc.playing}>
                        <p>{t.calc.playingHint}</p>
                        <p className="num mt-2 font-medium">{fmt(t.calc.factory, { w: fmtNum(base.weightG, 0, lang), b: fmtNum(base.balanceCm * 10, 0, lang), sw: fmtNum(base.swingweight, 0, lang) })}</p>
                        {racket.isStock && <div className="mt-3"><RacketSources racket={racket} /></div>}
                      </InfoTip>
                    </span>
                    {!racket.isStock && <Badge tone="accent">{t.library.custom}</Badge>}
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
                  <span className="block text-sm text-muted">{t.calc.measuredTitle}</span>
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
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <button
                    type="button"
                    aria-expanded={accOpen}
                    aria-controls="acc-list"
                    onClick={() => setAccOpen(!accOpen)}
                    className="-mx-1 flex min-h-9 items-center gap-1 rounded-md px-1 text-sm hover:bg-surface-2"
                  >
                    {accSummary}
                    <ChevronDown className={cx('size-4 text-muted transition-transform', accOpen && 'rotate-180')} aria-hidden />
                    <span className="sr-only">: {t.acc.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ baseMode: config.baseMode === 'reference' ? 'measured' : 'reference' })}
                    className="min-h-9 text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
                  >
                    {config.baseMode === 'reference' ? t.calc.useMeasured : t.calc.useFactory}
                  </button>
                </div>
                {accOpen && (
                  <div id="acc-list" role="group" aria-label={t.acc.title} className="mt-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    {ACC.map((k) => (
                      <Toggle
                        key={k}
                        label={t.acc[k]}
                        hint={`+${fmtNum(masses[k], 0, lang)} g`}
                        checked={config.accessories[k]}
                        onChange={(v) => setConfig({ accessories: { ...config.accessories, [k]: v } })}
                      />
                    ))}
                  </div>
                )}
              </div>
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
            {catalog && <p className="mt-2 text-xs text-muted">{t.calc.catalogNote}</p>}
          </Card>
          {/* Phones have the feel in the result bar, larger and always at hand. */}
          <Card className="order-4 hidden lg:block xl:order-none">
            <CardTitle info={<InfoTip title={t.calc.feel}>{t.calc.feelHint}</InfoTip>}>{t.calc.feel}</CardTitle>
            <FeelRings feel={f} />
            <FeelSource racket={racket} />
          </Card>
          <div className="order-8 xl:order-none"><ComfortCard racket={racket} specs={result} /></div>
          <div className="order-9 xl:order-none"><SaveButtons loaded={loaded} onSaveNew={() => setSaveOpen(true)} /></div>
          <div className="order-10 xl:order-none"><VerifyCard predicted={result} catalog={catalog} /></div>
        </div>
      </div>

      {/* Phones: the result (and, opened, the feel) follows you while you move the sliders. */}
      <ResultBar racket={racket} result={result} base={play} feel={f} feelBase={racketFeel(racket, noLead?.result ?? result, config.strings, masses)} open={barOpen} onToggle={toggleBar} />
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
/** From catalogue specs: what one production frame differs from the next. */
const CATALOG_TOL = { weightG: 7, balanceMm: 7, swingweight: 7 }

/** Lets the player check the prediction against what they measure. */
function VerifyCard({ predicted, catalog }: { predicted: Specs; catalog: boolean }) {
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
  const tol = catalog ? CATALOG_TOL : VERIFY_TOL
  const ok = filled.every((r) => Math.abs(m[r.k]! - r.pred) <= tol[r.k])
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
                    <span className={cx('ml-2 text-xs', Math.abs(d) <= tol[r.k] ? 'text-success' : 'text-warning')}>{fmtSigned(d, 1, lang)}</span>
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
          {ok ? (catalog ? t.calc.verifyCatalogOk : t.calc.verifyOk) : t.calc.verifyOff}
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
function ResultBar({ racket, result, base, feel: f, feelBase, open, onToggle }: { racket: Racket; result: Specs; base: Specs; feel: Feel; feelBase: Feel; open: boolean; onToggle: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <div className="result-bar fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
      {open && (
        <div id="result-bar-feel" className="mx-auto max-w-lg border-b border-border pb-2">
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-muted">{t.calc.feel}</span>
            <InfoTip title={t.calc.feel}>
              {t.calc.feelHint}
              <FeelSource racket={racket} />
            </InfoTip>
          </div>
          <ul aria-label={t.calc.feel} className="grid grid-cols-3 gap-x-2 gap-y-2">
            {FEEL_KEYS.map((k) => (
              <MiniRing key={k} label={t.feel[k]} value={f[k]} delta={f[k] - feelBase[k]} color={`var(--c-${k})`} lang={lang} />
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="result-bar-feel"
        aria-label={t.calc.feel}
        onClick={onToggle}
        className="num mx-auto flex w-full max-w-lg items-center py-2 text-center text-xs"
      >
        <Mini label={t.spec.weight} unit={t.units.g} value={fmtNum(result.weightG, 0, lang)} delta={result.weightG - base.weightG} lang={lang} />
        <Mini label={t.spec.balance} unit={t.units.mm} value={fmtNum(result.balanceCm * 10, 0, lang)} delta={(result.balanceCm - base.balanceCm) * 10} lang={lang} />
        <Mini label="SW" unit={t.units.kgcm2} value={fmtNum(result.swingweight, 0, lang)} delta={result.swingweight - base.swingweight} lang={lang} />
        <Mini label="TW" unit={t.units.kgcm2} value={fmtNum(result.twistweight, 1, lang)} delta={(result.twistweight ?? 0) - (base.twistweight ?? 0)} lang={lang} />
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

function Mini({ label, value, unit, delta, digits = 1, lang }: { label: string; value: string; unit: string; delta: number; digits?: number; lang: string }) {
  const d = Math.round(delta * 10 ** digits) / 10 ** digits
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-muted">{label}</div>
      <div className="readout whitespace-nowrap text-sm">
        {value}
        <span className="ml-0.5 text-[11px] font-normal text-muted">{unit}</span>
      </div>
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

/**
 * Saves the working setup, and says which of the player's rackets it is on:
 * one of theirs, a new one (made here, with the strings on it now), or none.
 */
function SaveSetupSheet({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const t = useT()
  const toast = useToast()
  const config = useStore((s) => s.config)
  const loadConfig = useStore((s) => s.loadConfig)
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const owned = useOwned()
  const racket = useRacket(config.racketId)
  const [name, setName] = useState('')
  const [racketName, setRacketName] = useState('')
  const active = (owned ?? []).filter((o) => !o.retired)
  // Your racket of this frame if there is one; a new racket if you have none.
  const suggested = active.find((o) => o.racketId === config.racketId)?.id ?? (active.length ? 'none' : 'new')
  const [on, setOn] = useState<string>(suggested)
  const lang = useStore((s) => s.lang)
  // When the sheet opens, in the same render (not an effect, which would
  // land after the field shows and could mix with what is being typed):
  // where to put it, and a name to start from, the frame and what changed
  // most. Editable.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setOn(suggested)
      setName(suggestSetupName(config, racket, t, lang))
    }
  }
  const fallback = fmt(t.setups.defaultName, { n: count + 1 })

  const save = async () => {
    if (!pro && count >= FREE_SETUP_LIMIT) {
      onClose()
      paywall('setups')
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
    let where: string | undefined
    if (on === 'new') {
      // A name of its own, never a clash with another of yours.
      const base = racketName.trim() || racket?.model || s.name
      const taken = new Set(active.map((o) => o.name.toLowerCase()))
      let n = 1
      let label = base
      while (taken.has(label.toLowerCase())) label = `${base} #${++n}`
      const id = uid()
      await saveOwned({ id, name: label, racketId: config.racketId, setupId: s.id, createdAt: now, updatedAt: now + 1 })
      await saveStringing({ id: uid(), ownedId: id, label, racketId: config.racketId, setupId: s.id, date: now, bed: structuredClone(config.strings ?? DEFAULT_STRINGBED), createdAt: now, updatedAt: now })
      where = label
    } else if (on !== 'none') {
      const o = active.find((x) => x.id === on)
      if (o) {
        await saveOwned({ ...o, racketId: config.racketId, setupId: s.id, updatedAt: now })
        where = o.name
      }
    }
    loadConfig(config, s.id)
    setName('')
    setRacketName('')
    onClose()
    toast(where ? fmt(t.calc.savedOn, { name: where }) : t.common.saved)
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
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField label={t.calc.setupName} value={name} onChange={setName} placeholder={fallback} maxLength={60} autoFocus />
        <ChoiceChips
          label={t.calc.saveOn}
          value={on}
          onChange={setOn}
          options={[...active.map((o) => ({ value: o.id, label: o.name })), { value: 'new', label: t.journal.addRacket }, { value: 'none', label: t.calc.saveSetupOnly }]}
        />
        {on === 'new' && (
          <TextField label={t.calc.newRacketName} hint={t.calc.newRacketHint} value={racketName} onChange={setRacketName} placeholder={racket?.model ?? t.journal.racketNamePlaceholder} maxLength={40} />
        )}
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

/** Where the feel starts: independent playtests of the frame, or of its closest sibling. */
function FeelSource({ racket }: { racket: Racket }) {
  const t = useT()
  const rev = reviewOf(racket)
  if (!rev) return <p className="mt-3 text-xs text-muted">{t.calc.feelSpecsOnly}</p>
  const like = rev.key.split('|')
  return <p className="mt-3 text-xs text-muted">{rev.own ? t.calc.feelFrom : fmt(t.calc.feelFromLike, { model: `${like[1]} ${like[2]}`.trim() })}</p>
}
