import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveOwned, saveStringing, uid } from '../data/db'
import { STOCK_RACKETS } from '../data/rackets'
import { useStore } from '../data/store'
import { restringDue, type OwnedRacket, type Stringing } from '../domain/journal'
import { DEFAULT_STRINGBED, MATERIALS, type Stringbed, type StringMaterial } from '../domain/strings'
import type { Racket } from '../domain/types'
import { fmt, useT } from '../i18n'
import { GOALS, LEVELS, STYLES } from '../lib/community'
import { IS_APP } from '../lib/platform'
import { Button, ChoiceChips, cx, MultiChoiceChips, NumberField, Segmented, Select, TextField } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { useOpenOwned } from '../ui/MyRackets'
import { useToast } from '../ui/overlay'
import { matchesQuery } from '../ui/RacketPicker'
import { bedLabel } from '../ui/strings'
import { usePaywall } from './Pro'
import { useReminders } from './reminders'

/** The frames most players have, on top before any search. */
const POPULAR = [
  'stock-babolat-pure-aero-98-2026',
  'stock-babolat-pure-drive-2025',
  'stock-head-speed-mp-2026',
  'stock-wilson-blade-98-16x19-v10-2026',
  'stock-yonex-ezone-100-300g-2025',
  'stock-head-radical-mp-2025',
  'stock-yonex-vcore-100-300g-2026',
  'stock-wilson-pro-staff-97-v14-2023',
]
const popular = POPULAR.map((id) => STOCK_RACKETS.find((r) => r.id === id)).filter((r): r is Racket => !!r)

const WHEN = { today: 0, week: 7, twoWeeks: 14, month: 30, more: 60 } as const
const HOURS = { light: 1.5, some: 3.5, lots: 6, most: 9 } as const
const DAY = 86_400_000

type Step = 'welcome' | 'racket' | 'strings' | 'goals' | 'reminders' | 'done'
const COUNTED: Step[] = ['racket', 'strings', 'goals', 'reminders']

/** "Pure Aero #1", "Pure Aero #2", ...: the second and later of the same frame. */
export const nthName = (name: string, n: number) => (n === 1 ? name : /#1$/.test(name) ? name.replace(/#1$/, `#${n}`) : `${name} #${n}`)

/**
 * The first launch of the store apps: the player's racket, its strings,
 * what they want to improve, and reminders, each step skippable. No account
 * and no paywall here.
 */
export function Onboarding() {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const setOnboarded = useStore((s) => s.setOnboarded)
  const openOwned = useOpenOwned()
  const reminders = useReminders()
  const paywall = usePaywall()

  const [step, setStep] = useState<Step>('welcome')
  const [q, setQ] = useState('')
  const [racket, setRacket] = useState<Racket>()
  const [name, setName] = useState('')
  const [count, setCount] = useState<'1' | '2' | '3' | '4'>('1')
  const [owned, setOwned] = useState<OwnedRacket[]>([])
  const [material, setMaterial] = useState<StringMaterial>(DEFAULT_STRINGBED.mains.material)
  const [tension, setTension] = useState<number | undefined>(DEFAULT_STRINGBED.mains.tensionKg)
  const [when, setWhen] = useState<keyof typeof WHEN>('today')
  const [hours, setHours] = useState<keyof typeof HOURS>()
  const [stringing, setStringing] = useState<Stringing>()
  const [goals, setGoals] = useState(profile.goals ?? [])
  const [level, setLevel] = useState(profile.level)
  const [style, setStyle] = useState(profile.style)

  const found = useMemo(() => (q.trim() ? STOCK_RACKETS.filter((r) => matchesQuery(r, q)).slice(0, 8) : popular), [q])

  const finish = (to: string) => {
    setOnboarded(true)
    nav(to, { replace: true })
    // Off unless the offering's metadata says onboarding_paywall: true.
    if (IS_APP)
      void import('../lib/purchases')
        .then((m) => m.offeringFlag('onboarding_paywall'))
        .then((on) => on && paywall('profile', { asked: true }))
        .catch(() => {})
  }
  const afterGoals = (): Step => (IS_APP && reminders.supported && reminders.permission === 'default' ? 'reminders' : 'done')

  const pick = (r: Racket) => {
    setRacket(r)
    setName(`${r.model} #1`)
  }
  const saveRackets = async () => {
    if (!racket) return setStep('goals')
    const at = Date.now()
    const base = name.trim() || `${racket.model} #1`
    const made = Array.from({ length: Number(count) }, (_, i): OwnedRacket => ({ id: uid(), name: nthName(base, i + 1), racketId: racket.id, createdAt: at, updatedAt: at }))
    for (const o of made) await saveOwned(o)
    setOwned(made)
    setStep('strings')
  }
  const saveStrings = async () => {
    const bed: Stringbed = { mains: { material, tensionKg: tension ?? DEFAULT_STRINGBED.mains.tensionKg } }
    const at = Date.now()
    const date = at - WHEN[when] * DAY
    let first: Stringing | undefined
    for (const o of owned) {
      const s: Stringing = { id: uid(), ownedId: o.id, label: o.name, racketId: o.racketId, date, bed, createdAt: at, updatedAt: at }
      await saveStringing(s)
      first ??= s
    }
    setStringing(first)
    if (hours) setProfile({ hoursPerWeek: HOURS[hours] })
    setStep('goals')
  }
  const saveGoals = () => {
    setProfile({ goals, level, style })
    setStep(afterGoals())
  }

  const skip: Record<Step, () => void> = {
    welcome: () => finish('/'),
    racket: () => setStep('goals'),
    strings: () => setStep('goals'),
    goals: () => setStep(afterGoals()),
    reminders: () => setStep('done'),
    done: () => finish('/'),
  }
  const n = COUNTED.indexOf(step) + 1

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <header className="flex min-h-11 items-center justify-between">
        <span className="text-sm text-muted">{n > 0 && fmt(t.onboarding.step, { n, total: COUNTED.length })}</span>
        {step !== 'done' && step !== 'reminders' && (
          <button type="button" onClick={skip[step]} className="rounded-md px-2 py-2 text-sm font-semibold text-muted hover:text-text">
            {t.onboarding.skip}
          </button>
        )}
      </header>

      {step === 'welcome' && (
        <Page
          footer={
            <>
              <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('racket')}>
                {t.onboarding.start}
              </Button>
              <button type="button" onClick={() => finish('/perfil')} className="min-h-11 w-full text-sm text-muted underline-offset-2 hover:underline">
                {t.onboarding.haveAccount}
              </button>
            </>
          }
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <Logo className="size-24" />
            <h1 className="text-xl font-semibold tracking-tight">{t.onboarding.welcomeTitle}</h1>
            <p className="text-muted">{t.onboarding.welcomeText}</p>
          </div>
        </Page>
      )}

      {step === 'racket' && (
        <Page
          title={t.onboarding.racketTitle}
          text={t.onboarding.racketText}
          footer={
            <Button variant="primary" size="lg" className="w-full" disabled={!racket} onClick={saveRackets}>
              {t.onboarding.next}
            </Button>
          }
        >
          <TextField label={t.onboarding.search} value={q} onChange={setQ} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">{q.trim() ? t.onboarding.results : t.onboarding.popular}</span>
            {found.length === 0 ? (
              <p className="text-sm text-muted">{t.onboarding.noResults}</p>
            ) : (
              <div role="radiogroup" aria-label={t.onboarding.racketTitle} className="divide-y divide-border rounded-md border border-border">
                {found.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={racket?.id === r.id}
                    onClick={() => pick(r)}
                    className={cx('flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-sm', racket?.id === r.id ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2')}
                  >
                    <span>
                      <span className="text-muted">{r.brand}</span> {r.model}
                      {r.year && <span className="text-muted"> ({r.year})</span>}
                    </span>
                    {racket?.id === r.id && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-text" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {racket && (
            <>
              <TextField label={t.onboarding.name} hint={t.onboarding.nameHint} value={name} onChange={setName} maxLength={40} />
              <div>
                <span className="mb-1.5 block text-sm font-medium text-muted">{t.onboarding.count}</span>
                <Segmented label={t.onboarding.count} value={count} onChange={setCount} options={(['1', '2', '3', '4'] as const).map((v) => ({ value: v, label: v }))} />
              </div>
            </>
          )}
        </Page>
      )}

      {step === 'strings' && (
        <Page
          title={t.onboarding.stringsTitle}
          text={t.onboarding.stringsText}
          footer={
            <Button variant="primary" size="lg" className="w-full" onClick={saveStrings}>
              {t.onboarding.next}
            </Button>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <Select label={t.strings.material} value={material} onChange={setMaterial} options={MATERIALS.map((m) => ({ value: m, label: t.strings.materials[m] }))} />
            <NumberField label={t.strings.tension} unit="kg" min={10} max={40} value={tension} onChange={setTension} />
          </div>
          <ChoiceChips label={t.onboarding.strungWhen} value={when} onChange={setWhen} options={(Object.keys(WHEN) as (keyof typeof WHEN)[]).map((k) => ({ value: k, label: t.onboarding.when[k] }))} />
          <ChoiceChips label={t.onboarding.hours} value={hours} onChange={setHours} options={(Object.keys(HOURS) as (keyof typeof HOURS)[]).map((k) => ({ value: k, label: t.onboarding.hourOptions[k] }))} />
        </Page>
      )}

      {step === 'goals' && (
        <Page
          title={t.onboarding.goalsTitle}
          text={t.onboarding.goalsText}
          footer={
            <Button variant="primary" size="lg" className="w-full" onClick={saveGoals}>
              {t.onboarding.next}
            </Button>
          }
        >
          <MultiChoiceChips label={t.community.goal} value={goals} onChange={setGoals} max={2} options={GOALS.map((g) => ({ value: g, label: t.community.goals[g] }))} />
          <ChoiceChips label={t.community.level} value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: t.community.levels[l] }))} />
          <ChoiceChips label={t.community.style} value={style} onChange={setStyle} options={STYLES.map((s) => ({ value: s, label: t.community.styles[s] }))} />
        </Page>
      )}

      {step === 'reminders' && (
        <Page
          title={t.onboarding.remindersTitle}
          text={t.onboarding.remindersText}
          footer={
            <>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={async () => {
                  await reminders.enable()
                  setStep('done')
                }}
              >
                {t.onboarding.remindersOn}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => setStep('done')}>
                {t.onboarding.notNow}
              </Button>
            </>
          }
        />
      )}

      {step === 'done' && (
        <Page
          title={t.onboarding.doneTitle}
          footer={
            <>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  if (owned[0]) openOwned(owned[0])
                  toast(t.onboarding.tips[goals[0] ?? 'none'])
                  finish('/')
                }}
              >
                {t.onboarding.openCalc}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => finish('/perfil')}>
                {t.onboarding.seeProfile}
              </Button>
            </>
          }
        >
          {owned[0] && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="font-semibold">{owned[0].name}</p>
              <p className="num text-sm text-muted">
                {[stringing && bedLabel(stringing.bed, t, lang), stringing && dueLine(stringing, profile.hoursPerWeek, t)].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
          <p className="text-sm text-muted">{t.onboarding.freePro}</p>
        </Page>
      )}
    </div>
  )
}

function dueLine(s: Stringing, hoursPerWeek: number | undefined, t: ReturnType<typeof useT>) {
  const days = Math.round((restringDue(s, [], hoursPerWeek) - Date.now()) / DAY)
  return days <= 0 ? t.onboarding.dueSoon : fmt(t.onboarding.dueIn, { n: days })
}

function Page({ title, text, children, footer }: { title?: string; text?: string; children?: ReactNode; footer: ReactNode }) {
  return (
    <>
      <main className="flex flex-1 flex-col gap-5 py-4">
        {title && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {text && <p className="mt-1 text-sm text-muted">{text}</p>}
          </div>
        )}
        {children}
      </main>
      <div className="sticky bottom-0 space-y-1 bg-bg pt-3">{footer}</div>
    </>
  )
}
