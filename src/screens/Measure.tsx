import { ArrowLeft, Play, Plus, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mean, swingweightFromPeriod, swingweightUncertainty } from '../domain/measure'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum } from '../lib/format'
import { Button, Card, CardTitle, NumberField, PageTitle } from '../ui/basics'
import { useToast } from '../ui/overlay'

interface Trial {
  totalS: number
  swings: number
}

/** Weight, balance and a pendulum swingweight, with a tap timer. */
export function Measure() {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const setConfig = useStore((s) => s.setConfig)

  const [weightG, setWeight] = useState<number>()
  const [balanceMm, setBalance] = useState<number>()
  const [pivotCm, setPivot] = useState<number | undefined>(10)
  const [swings, setSwings] = useState<number | undefined>(20)
  const [trials, setTrials] = useState<Trial[]>([])
  const [typed, setTyped] = useState<number>()

  // Tap timer.
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (startedAt === null) return
    const tick = () => {
      setNow(performance.now())
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [startedAt])

  const n = swings ?? 20
  const addTrial = (totalS: number) => {
    if (totalS > 0) setTrials((x) => [...x, { totalS, swings: n }])
  }

  const ready = weightG !== undefined && balanceMm !== undefined && pivotCm !== undefined
  const periods = trials.map((x) => x.totalS / x.swings)
  const period = periods.length ? mean(periods) : undefined
  const sw = ready && period ? swingweightFromPeriod(weightG!, balanceMm! / 10, period, pivotCm) : undefined
  const uncertainty = sw && period ? swingweightUncertainty(sw, period, mean(trials.map((x) => x.swings)), trials.length) : undefined

  const use = () => {
    setConfig({
      baseMode: 'measured',
      measured: { weightG, balanceCm: balanceMm === undefined ? undefined : balanceMm / 10, swingweight: sw === undefined ? undefined : Math.round(sw * 10) / 10 },
      accessories: { strings: false, leatherGrip: false, overgrip: false, dampener: false },
      leadG: { ...config.leadG, tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 },
      extra: [],
    })
    toast(t.measure.used)
    nav('/')
  }

  return (
    <>
      <PageTitle>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => nav(-1)} aria-label={t.common.back} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {t.measure.title}
        </span>
      </PageTitle>
      <p className="-mt-2 mb-4 max-w-2xl text-sm text-muted">{t.measure.intro}</p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-4">
          <Card label={t.measure.step1}>
            <CardTitle>{t.measure.step1}</CardTitle>
            <p className="mb-3 text-sm text-muted">{t.measure.step1Hint}</p>
            <div className="max-w-[220px]">
              <NumberField label={t.spec.weight} unit="g" min={150} max={500} value={weightG} onChange={setWeight} />
            </div>
          </Card>

          <Card label={t.measure.step2}>
            <CardTitle>{t.measure.step2}</CardTitle>
            <p className="mb-3 text-sm text-muted">{t.measure.step2Hint}</p>
            <div className="max-w-[220px]">
              <NumberField label={t.spec.balance} unit="mm" min={250} max={400} value={balanceMm} onChange={setBalance} />
            </div>
          </Card>

          <Card label={t.measure.step3}>
            <CardTitle>{t.measure.step3}</CardTitle>
            <p className="mb-3 text-sm text-muted">{t.measure.step3Hint}</p>
            <div className="grid max-w-[460px] grid-cols-2 gap-3">
              <NumberField label={t.measure.pivot} unit="cm" min={2} max={20} value={pivotCm} onChange={setPivot} />
              <NumberField label={t.measure.swings} min={3} max={100} value={swings} onChange={(v) => setSwings(v === undefined ? undefined : Math.round(v))} />
            </div>

            <p className="mt-4 text-sm text-muted">{t.measure.tapHint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {startedAt === null ? (
                <Button variant="primary" size="lg" icon={Play} onClick={() => setStartedAt(performance.now())} disabled={!swings}>
                  {t.measure.start}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  icon={Square}
                  onClick={() => {
                    addTrial((performance.now() - startedAt) / 1000)
                    setStartedAt(null)
                  }}
                >
                  {t.measure.stop}
                </Button>
              )}
              <span className="num text-lg font-semibold" aria-live="off">
                {startedAt !== null && fmt(t.measure.running, { s: fmtNum((now - startedAt) / 1000, 1, lang) })}
              </span>
            </div>

            <div className="mt-4 flex max-w-[460px] items-end gap-3">
              <div className="flex-1">
                <NumberField label={`${t.measure.orType} (${n})`} unit="s" min={1} max={300} value={typed} onChange={setTyped} />
              </div>
              <Button
                icon={Plus}
                disabled={typed === undefined}
                onClick={() => {
                  if (typed !== undefined) addTrial(typed)
                  setTyped(undefined)
                }}
              >
                {t.measure.addTrial}
              </Button>
            </div>

            {trials.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm text-muted">{t.measure.trials}</h3>
                <ul className="space-y-1">
                  {trials.map((x, i) => (
                    <li key={i} className="num flex items-center justify-between gap-2 rounded-md bg-surface-2/60 px-3 py-1.5 text-sm">
                      {fmt(t.measure.trial, { n: i + 1, t: fmtNum(x.totalS, 2, lang), p: fmtNum(x.totalS / x.swings, 3, lang) })}
                      <button
                        type="button"
                        aria-label={fmt(t.measure.removeTrial, { n: i + 1 })}
                        onClick={() => setTrials(trials.filter((_, j) => j !== i))}
                        className="rounded-full p-1 text-muted hover:text-text"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="xl:sticky xl:top-8">
          <Card label={t.measure.result}>
            <CardTitle>{t.measure.result}</CardTitle>
            {!ready ? (
              <p className="text-sm text-muted">{t.measure.needWB}</p>
            ) : sw === undefined ? (
              <p className="text-sm text-muted">{t.measure.tapHint}</p>
            ) : (
              <>
                <p className="num text-display font-extrabold" data-testid="measured-sw">
                  {fmtNum(sw, 1, lang)}
                </p>
                <p className="num text-sm text-muted">{fmt(t.measure.plusMinus, { u: fmtNum(uncertainty, 1, lang) })}</p>
                {trials.length < 3 && <p className="mt-2 text-sm">{t.measure.moreTrials}</p>}
              </>
            )}
            <Button variant="primary" className="mt-4 w-full" disabled={!ready} onClick={use}>
              {t.measure.use}
            </Button>
          </Card>
        </div>
      </div>
    </>
  )
}
