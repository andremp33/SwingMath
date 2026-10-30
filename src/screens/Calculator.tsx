import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Gauge, Info, Plus, RotateCcw, Ruler, Save, Scale, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { geometry } from '../domain/physics'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { emptyLead, POSITIONS, type Position, type Racket, type Setup, type Specs } from '../domain/types'
import { saveOwned, saveSetup, saveStringing, uid } from '../data/db'
import { useComputed, useOwned, useRacket, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { countCopy } from '../lib/community'
import { fmtNum, fmtSigned, LOCALE } from '../lib/format'
import { Badge, Button, Card, CardTitle, ChoiceChips, cx, IconButton, NumberField, PageTitle, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { LeadEditor } from '../ui/lead'
import { Sheet, useToast } from '../ui/overlay'
import { MyRacketsRow, useActiveOwned } from '../ui/MyRackets'
import { useUnits } from '../lib/units'
import { RacketPicker } from '../ui/RacketPicker'
import { FeelRings, SpecStrip, SpecTable, useSpecRows } from '../ui/specs'
import { ComfortCard, GoalsCard, GripCard, StringsCard, SweetSpotCard } from './CalcExtras'
import { CommunityCard, CommunityLink } from './Community'
import { InfoSheet } from './InfoSheet'
import { CollapsibleCard, InfoTip } from '../ui/disclosure'
import { OnceHint } from '../ui/hint'
import { RacketSources } from './RacketSources'
import { useSetupRoom } from './freePlans'
import { usePaywall } from './Pro'
import { racketFeel, reviewOf } from '../data/racketFeel'
import { FEEL_KEYS, type Feel } from '../domain/feel'
import { suggestSetupName } from '../lib/setupName'
import { BalanceField, WeightField } from '../ui/unitFields'

export function Calculator() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const masses = useStore((s) => s.masses)
  const setConfig = useStore((s) => s.setConfig)
  const setLead = useStore((s) => s.setLead)
  const resetConfig = useStore((s) => s.resetConfig)
  const loadedSetupId = useStore((s) => s.loadedSetupId)
  const units = useUnits()
  const racket = useRacket(config.racketId)
  const computed = useComputed(config, racket)
  // The same setup without lead: what the feel bar compares against.
  const noLeadConfig = useMemo(() => ({ ...config, leadG: emptyLead(), extra: [] }), [config])
  const noLead = useComputed(noLeadConfig, racket)
  const setups = useSetups()
  const room = useSetupRoom()
  const paywall = usePaywall()
  const loaded = setups?.find((s) => s.id === loadedSetupId)
  const [selected, setSelected] = useState<Position | string>('tip')
  const [addOpen, setAddOpen] = useState(false)
  const updateExtra = useStore((s) => s.updateExtra)
  const removeExtra = useStore((s) => s.removeExtra)
  const addExtra = useStore((s) => s.addExtra)
  const [infoOpen, setInfoOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const mine = useActiveOwned()
  // The first launch's tip, by the player's goal, until they try it or close it.
  const [params, setParams] = useSearchParams()
  const tip = params.get('dica')
  const closeTip = () => setParams({}, { replace: true })

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
  // Picks a spot on the racket and puts the keyboard on it.
  const focusSlider = (id: string) => {
    setSelected(id)
    document.querySelector<HTMLElement>(`[data-lead="${id}"]`)?.focus({ preventScroll: true })
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


      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="contents md:block md:space-y-4">
          <Card className="order-1 md:order-none">
            <div className="space-y-4">
              {/* The player's own rackets first; the picker then names their model. */}
              <MyRacketsRow />
              <div>
                <RacketPicker label={mine ? fmt(t.calc.modelOf, { name: mine.name }) : t.calc.racket} value={racket} onChange={(r) => setConfig({ racketId: r.id })} />
                <CommunityLink racket={racket} />
              </div>
              {config.baseMode === 'reference' ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      {t.calc.playing}
                      <InfoTip title={t.calc.playing}>
                        <p>{t.calc.playingHint}</p>
                        <p className="num mt-2 font-medium">{fmt(t.calc.factory, { w: `${units.weight(base.weightG)} ${units.weightUnit}`, b: `${units.balance(base.balanceCm)} ${units.balanceUnit}`, sw: fmtNum(base.swingweight, 0, lang) })}</p>
                        {racket.isStock && <div className="mt-3"><RacketSources racket={racket} /></div>}
                      </InfoTip>
                    </span>
                    {!racket.isStock && <Badge tone="accent">{t.library.custom}</Badge>}
                  </div>
                  <div className="xl:hidden">
                    <SpecStrip rows={baseRows} explain />
                  </div>
                  <div className="hidden xl:block">
                    <SpecTable rows={baseRows} showDelta={false} explain />
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
                    <WeightField
                      label={t.spec.weight}
                      min={150}
                      max={450}
                      placeholder={racket.weightG}
                      value={config.measured.weightG}
                      onChange={(v) => setConfig({ measured: { ...config.measured, weightG: v } })}
                    />
                    <BalanceField
                      label={t.spec.balance}
                      min={250}
                      max={400}
                      placeholder={racket.balanceCm * 10}
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

          <Card className="order-2 md:order-none">
            <CardTitle action={<span className="text-sm text-muted">{t.calc.totalLead}: <span className="readout text-text">{fmtNum(totalLead, 1, lang)} g</span></span>}>
              {t.calc.lead}
            </CardTitle>
            {tip && tip in t.onboarding.tips ? (
              <TipCard
                goal={tip as keyof typeof t.onboarding.tips}
                onTry={(p, g) => {
                  setLead(p, Math.max(config.leadG[p], g))
                  closeTip()
                  focusSlider(p)
                }}
                onClose={closeTip}
              />
            ) : (
              // Where to start, until the player has put lead on once.
              <OnceHint id="lead" done={totalLead > 0} className="mb-3">
                {t.calc.leadHint}
              </OnceHint>
            )}
            {/* The racket keeps its own tones on the panel (index.css). */}
            <div className="racket-tones">
              <LeadEditor
                sweetSpot={{ x: result.sweetSpotCm, g: geo!, from: noLead?.result.sweetSpotCm }}
                geometry={geo}
                pattern={racket.pattern}
                lead={config.leadG}
                extra={extra}
                selected={selected}
                onSelect={setSelected}
                onLead={setLead}
                onExtra={(id, grams) => updateExtra(id, { grams })}
                onRemoveExtra={(id) => {
                  removeExtra(id)
                  setSelected('tip')
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3" role="group" aria-labelledby="custom-title">
              <h3 id="custom-title" className="flex items-center gap-1.5 text-sm text-muted">
                {t.custom.title}
                <InfoTip title={t.custom.title}>{t.custom.hint}</InfoTip>
              </h3>
              <Button size="sm" icon={Plus} onClick={() => setAddOpen(true)} disabled={extra.length >= 12}>
                {t.custom.add}
              </Button>
            </div>
          </Card>
          <div className="order-2 md:order-none">
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
          <div className="order-6 md:order-none"><StringsCard racket={racket} /></div>
          <div className="order-7 md:order-none"><GripCard /></div>
          <div className="order-11 md:order-none"><CommunityCard racket={racket} /></div>
        </div>

        <div className="contents md:sticky md:top-20 md:block lg:top-8 md:space-y-4">
          {/* Phones have the main numbers in the bar: the full table folds, with
              what the bar leaves out as its summary. */}
          <div className="order-3 md:order-none">
            <CollapsibleCard
              id="result"
              title={t.calc.result}
              openFrom={768}
              summary={`${t.spec.recoil} ${fmtNum(result.recoilWeight, 0, lang)} · ${t.spec.sweetSpot} ${fmtNum(result.sweetSpotCm, 1, lang)} cm`}
              info={
                <InfoTip title={t.calc.result}>
                  {catalog && <p>{t.calc.catalogNote}</p>}
                  <p>{t.calc.resultNotes}</p>
                </InfoTip>
              }
            >
              <SpecTable rows={resultRows} explain />
            </CollapsibleCard>
          </div>
          {/* Phones have the feel in the result bar, larger and always at hand. */}
          <Card className="order-4 hidden md:block md:order-none">
            <CardTitle info={<InfoTip title={t.calc.feel}>{t.calc.feelHint}</InfoTip>}>{t.calc.feel}</CardTitle>
            <FeelRings feel={f} />
            <FeelSource racket={racket} />
          </Card>
          <div className="order-5 md:order-none"><GoalsCard racket={racket} result={result} /></div>
          <div className="order-8 md:order-none"><ComfortCard racket={racket} specs={result} /></div>
          <div className="order-9 md:order-none"><SaveButtons loaded={loaded} onSaveNew={() => (room ? setSaveOpen(true) : paywall('setups', { asked: true }))} /></div>
          <div className="order-10 md:order-none"><VerifyCard predicted={result} catalog={catalog} /></div>
        </div>
      </div>

      {/* Phones: the result (and, opened, the feel) follows you while you move the sliders. */}
      <ResultBar racket={racket} result={result} base={play} feel={f} feelBase={racketFeel(racket, noLead?.result ?? result, config.strings, masses)} open={barOpen} onToggle={toggleBar} />
      <div className={cx('md:hidden', barOpen ? 'h-52' : 'h-20')} />

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

/** What each goal's tip has the player try: grams (all of them, both sides
 *  where there are two) at one position. Spin and comfort are the strings'. */
const TRY_LEAD: Partial<Record<string, [Position, number]>> = {
  stability: ['threeNine', 4],
  control: ['threeNine', 4],
  power: ['tip', 2],
  manoeuvrability: ['handle', 5],
}

/** The first launch's tip, by the player's first goal, with the lead to try
 *  in one tap: the numbers below then show what it did. */
function TipCard({ goal, onTry, onClose }: { goal: keyof Dict['onboarding']['tips']; onTry: (p: Position, g: number) => void; onClose: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const lead = TRY_LEAD[goal]
  return (
    <div role="note" className="mb-3 flex items-start gap-2 rounded-md bg-surface-2 py-2.5 pl-3 pr-1.5 text-sm">
      <div className="min-w-0 flex-1 space-y-2">
        <p>{t.onboarding.tips[goal]}</p>
        {lead && (
          <Button size="sm" variant="primary" onClick={() => onTry(lead[0], lead[1])}>
            {fmt(t.calc.tryLead, { g: fmtNum(lead[1], 0, lang), pos: t.pos[lead[0]] })}
          </Button>
        )}
      </div>
      <IconButton icon={X} label={t.common.close} onClick={onClose} />
    </div>
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

/** The bar above the tabs: the four numbers, and under them the feel the
 *  player cares about (their goals, else power, control and spin); a tap
 *  there opens all six above, with how much the lead moved each one. */
function ResultBar({ racket, result, base, feel: f, feelBase, open, onToggle }: { racket: Racket; result: Specs; base: Specs; feel: Feel; feelBase: Feel; open: boolean; onToggle: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const goals = useStore((s) => s.profile.goals) ?? []
  const units = useUnits()
  const keys = [...new Set([...FEEL_KEYS.filter((k) => (goals as string[]).includes(k)), 'power', 'control', 'spin'] as const)].slice(0, 3)
  return (
    <div className="result-bar fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 backdrop-blur md:hidden">
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
              <MiniRing key={k} label={t.feel[k]} value={f[k]} delta={f[k] - feelBase[k]} color={`var(--c-${k})`} lang={lang} mark={(goals as string[]).includes(k)} />
            ))}
          </ul>
        </div>
      )}
      <div className="num mx-auto flex w-full max-w-lg items-center pt-2 text-center text-xs">
        <Mini label={t.spec.weight} unit={units.weightUnit} value={units.weight(result.weightG)} delta={units.toWeight(result.weightG - base.weightG)} digits={units.imperial ? 2 : 1} lang={lang} />
        <Mini label={t.spec.balance} unit={units.balanceUnit} value={units.balance(result.balanceCm)} delta={units.toBalanceMm((result.balanceCm - base.balanceCm) * 10)} digits={units.imperial ? 2 : 1} lang={lang} />
        <Mini label="SW" unit={t.units.kgcm2} value={fmtNum(result.swingweight, 0, lang)} delta={result.swingweight - base.swingweight} lang={lang} />
        <Mini label="TW" unit={t.units.kgcm2} value={fmtNum(result.twistweight, 1, lang)} delta={(result.twistweight ?? 0) - (base.twistweight ?? 0)} lang={lang} />
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="result-bar-feel"
        aria-label={t.calc.feel}
        onClick={onToggle}
        className="@container mx-auto mt-1 flex w-full max-w-lg items-center gap-2 border-t border-border/60 py-1.5 text-xs"
      >
        <Gauge className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="flex min-w-0 flex-1 justify-around gap-2">
          {open ? (
            <span className="font-medium text-muted">{t.calc.feel}</span>
          ) : (
            keys.map((k, i) => {
              const d = Math.round(f[k] - feelBase[k])
              return (
                // With large text (rem grows) only the first fits whole: the
                // others wait for the room, rather than show cut.
                <span key={k} className={cx('num min-w-0 truncate', i > 0 && 'hidden @[20rem]:inline')}>
                  <span className="text-muted">{t.feel[k]} </span>
                  <span className="font-semibold">{Math.round(f[k])}</span>
                  {d !== 0 && <span className="ml-0.5 font-semibold text-accent-text">{fmtSigned(d, 0, lang)}</span>}
                </span>
              )
            })
          )}
        </span>
        <ChevronUp className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
    </div>
  )
}

function MiniRing({ label, value, delta, color, lang, mark }: { label: string; value: number; delta: number; color: string; lang: string; mark?: boolean }) {
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
        <span className={cx('num w-7 pl-1 text-[11px]', d === 0 ? 'text-muted' : 'font-semibold text-text')}>{d === 0 ? '' : fmtSigned(d, 0, lang)}</span>
      </div>
      <span className={cx('max-w-full truncate text-[11px]', mark ? 'font-semibold text-text' : 'text-muted')}>{label}</span>
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
      {/* Room kept for the difference, empty until there is one. */}
      <div className="num min-h-[1lh] text-[11px] text-muted">{d === 0 ? '' : fmtSigned(delta, digits, lang)}</div>
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
  const triedRecipe = useStore((s) => s.triedRecipe)
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
    const now = Date.now()
    const s: Setup = {
      ...structuredClone(config),
      id: uid(),
      name: name.trim() || fallback,
      favourite: false,
      ratings: {},
      fromRecipe: triedRecipe ?? undefined,
      createdAt: now,
      updatedAt: now,
    }
    await saveSetup(s)
    // A community recipe the player keeps: that is what its count means.
    if (triedRecipe) void countCopy(triedRecipe)
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
