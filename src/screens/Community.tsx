import { scrollToTop } from '../app/Shell'
import { ArrowRight, EyeOff, Flag, RefreshCw, Send, Trash2, Upload, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useOwned, useSessions, useSetups, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { SESSION_RATINGS, setupResults } from '../domain/journal'
import { compute } from '../domain/physics'
import type { Racket, Setup } from '../domain/types'
import { fmt, useT, type Dict } from '../i18n'
import {
  communityEnabled,
  countCopy,
  deletePublicSetup,
  measurementStats,
  BlockedWordsError,
  GOALS,
  HiddenRecipeError,
  LEVELS,
  publicSetups,
  myRecipe,
  publishSetup,
  rankPublicSetups,
  reportSetup,
  roundResults,
  setupCounts,
  STYLES,
  submitMeasurement,
  type Goal,
  type Level,
  type MeasurementStats,
  type PublicResults,
  type PublicSetup,
  type Style,
} from '../lib/community'
import { fmtNum, leadParts } from '../lib/format'
import { Badge, Button, Card, CardTitle, ChoiceChips, IconButton, MultiChoiceChips, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { CollapsibleCard, InfoTip, openCollapsible } from '../ui/disclosure'
import { useToast } from '../ui/overlay'
import { bedLabel } from '../lib/bedLabel'
import { useUnits } from '../lib/units'

/** Visible community setups per frame, for links into the calculator. */
export function useSetupCounts() {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map())
  useEffect(() => {
    let alive = true
    setupCounts().then((c) => alive && setCounts(c))
    return () => {
      alive = false
    }
  }, [])
  return counts
}

/** Under the racket picker: "3 community setups for this racket →". */
export function CommunityLink({ racket }: { racket: Racket }) {
  const t = useT()
  const n = useSetupCounts().get(racket.id) ?? 0
  if (!communityEnabled() || !racket.isStock || n < 1) return null
  return (
    <button
      type="button"
      onClick={() => openCollapsible('community')}
      className="-mx-1 flex min-h-9 items-center gap-1 rounded-md px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
    >
      <Users className="size-4 shrink-0" aria-hidden />
      {n === 1 ? t.community.forRacketOne : fmt(t.community.forRacket, { n })}
      <ArrowRight className="size-4 shrink-0" aria-hidden />
    </button>
  )
}

const SHOWN = 5

/** Calculator card: what players measured, and the recipes they published. */
export function CommunityCard({ racket }: { racket: Racket }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const u = useUnits()
  const account = useStore((s) => s.account)
  const loadConfig = useStore((s) => s.loadConfig)
  const masses = useStore((s) => s.masses)
  const mySetups = useSetups()
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  const toast = useToast()
  const [stats, setStats] = useState<MeasurementStats[]>()
  const [setups, setSetups] = useState<PublicSetup[]>()
  const [version, setVersion] = useState(0)
  const myGoal = useStore((s) => s.profile.goals?.[0]) ?? 'all'
  const [goal, setGoal] = useState<Goal | 'all'>(myGoal)
  const hidden = useStore((s) => s.hiddenAuthors)
  const hideAuthor = useStore((s) => s.hideAuthor)
  const showAuthor = useStore((s) => s.showAuthor)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let alive = true
    setStats(undefined)
    setSetups(undefined)
    setGoal(myGoal)
    setAll(false)
    measurementStats(racket.id).then((s) => alive && setStats(s))
    publicSetups(racket.id).then((s) => alive && setSetups(s))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racket.id, version])

  if (!communityEnabled() || !racket.isStock) return null

  const signedIn = (fn: () => Promise<void>) => async () => {
    if (!account) return toast(t.community.needAccount)
    try {
      await fn()
    } catch (err) {
      toast(err instanceof HiddenRecipeError ? t.community.hiddenRecipe : err instanceof BlockedWordsError ? t.community.blockedWords : t.community.error)
    }
  }

  // My own recipe, republished from the saved setup it came from.
  const update = (p: PublicSetup, local: Setup) =>
    signedIn(async () => {
      const { result } = compute({ spec: racket, ...local, masses })
      const results = p.results && owned && stringings && sessions ? setupResults(local.id, owned, stringings, sessions) : null
      const done = await publishSetup({
        name: local.name,
        author: p.author ?? undefined,
        config: local,
        racket,
        specs: result,
        goals: p.goals,
        level: p.level ?? undefined,
        style: p.style ?? undefined,
        results,
        setupRef: local.id,
      })
      toast(done === 'moved' ? t.community.moved : t.community.updated)
      setVersion((v) => v + 1)
    })

  // Authors the player hid stay out of sight on this phone.
  const list = (setups ?? []).filter((p) => !hidden.includes(p.user_id))
  const goalsHere = GOALS.filter((g) => list.some((p) => p.goals.includes(g)))
  // The player's goal, if this frame has recipes for it.
  const active = goal !== 'all' && goalsHere.includes(goal) ? goal : 'all'
  const ranked = rankPublicSetups(list, active === 'all' ? undefined : active)
  const shown = all ? ranked : ranked.slice(0, SHOWN)
  const measured = (stats ?? []).reduce((n, x) => n + x.n, 0)
  return (
    <CollapsibleCard
      id="community"
      title={t.community.title}
      summary={[measured ? fmt(t.community.measuredShort, { n: measured }) : '', list.length ? fmt(t.community.setupsShort, { n: list.length }) : ''].filter(Boolean).join(' · ') || undefined}
      info={<InfoTip title={t.community.title}>{t.community.medianHint}</InfoTip>}
    >
      <div className="space-y-2 text-sm">
        {stats === undefined ? null : stats.length === 0 ? (
          <p className="text-muted">{t.community.noStats}</p>
        ) : (
          stats.map((s) => (
            <div key={String(s.strung)}>
              <p className="text-muted">
                {fmt(t.community.measured, {
                  n: s.n,
                  state: s.strung ? t.community.strung : t.community.unstrung,
                })}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-muted">{t.spec.weight}</dt>
                  <dd className="readout">{fmtNum(s.weight_g, 1, lang)} g</dd>
                  <dd className="num text-xs text-muted">
                    {fmtNum(s.weight_p25, 1, lang)}–{fmtNum(s.weight_p75, 1, lang)}
                  </dd>
                </div>
                {s.balance_cm !== null && s.balance_n >= 3 && (
                  <div>
                    <dt className="text-xs text-muted">{t.spec.balance}</dt>
                    <dd className="readout">{fmtNum(s.balance_cm * 10, 1, lang)} mm</dd>
                  </div>
                )}
                {s.swingweight !== null && s.swingweight_n >= 3 && (
                  <div>
                    <dt className="text-xs text-muted">SW</dt>
                    <dd className="readout">{fmtNum(s.swingweight, 1, lang)}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))
        )}
      </div>

      <h3 className="mb-2 mt-4 text-sm font-medium">{t.community.setups}</h3>
      {setups === undefined ? null : list.length === 0 ? (
        <p className="text-sm text-muted">{t.community.noSetups}</p>
      ) : (
        <>
          {goalsHere.length > 0 && (
            <div className="mb-1">
              <ChoiceChips<Goal | 'all'>
                label={t.community.filter}
                value={active}
                onChange={(g) => {
                  setGoal(g)
                  setAll(false)
                }}
                options={[{ value: 'all', label: t.community.all }, ...goalsHere.map((g) => ({ value: g, label: t.community.goals[g] }))]}
              />
            </div>
          )}
          <ul className="divide-y divide-border">
            {shown.map((p) => {
              const mine = account?.userId === p.user_id
              const local = mine && p.setup_ref ? mySetups?.find((x) => x.id === p.setup_ref) : undefined
              const tags = [...p.goals.map((g) => t.community.goals[g]), p.level && t.community.levels[p.level], p.style && t.community.styles[p.style]].filter(Boolean) as string[]
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <p className="font-medium">
                      {p.name}{' '}
                      {p.partner ? (
                        <Badge tone="accent">{fmt(t.community.partner, { name: p.partner })}</Badge>
                      ) : (
                        <span className="font-normal text-muted">· {p.author || t.community.anon}</span>
                      )}
                    </p>
                    {tags.length > 0 && (
                      <p className="flex flex-wrap gap-1">
                        {tags.map((x) => (
                          <Badge key={x}>{x}</Badge>
                        ))}
                      </p>
                    )}
                    <p className="num text-muted">
                      {u.weight(p.specs.weightG)} {u.weightUnit} · {u.balance(p.specs.balanceCm)} {u.balanceUnit} · SW {fmtNum(p.specs.swingweight, 0, lang)} ·{' '}
                      {p.config.baseMode === 'measured' ? t.community.baseMeasured : t.community.baseCatalog}
                    </p>
                    <p className="num text-muted">
                      {leadParts(p.config, t, lang).join(' · ') || t.setups.noLead} · {p.copies === 1 ? t.community.copyOne : fmt(t.community.copies, { n: p.copies })}
                    </p>
                    {p.config.strings && (
                      <p className="num text-muted">
                        {t.strings.title}: {bedLabel(p.config.strings, t, lang)}
                      </p>
                    )}
                    {p.results && (
                      <p className="num">
                        {resultsLine(p.results, t, lang, { outOf: true })} <span className="text-xs text-muted">({t.community.fromJournal})</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        loadConfig({ ...p.config, racketId: racket.id }, null)
                        void countCopy(p.id)
                        toast(t.community.tried)
                        scrollToTop()
                      }}
                    >
                      {t.community.tryIt}
                    </Button>
                    {local && (
                      <Button size="sm" variant="ghost" icon={RefreshCw} onClick={update(p, local)}>
                        {t.community.updateMine}
                      </Button>
                    )}
                    {mine ? (
                      <IconButton
                        icon={Trash2}
                        label={`${t.community.remove} ${p.name}`}
                        onClick={signedIn(async () => {
                          await deletePublicSetup(p.id)
                          setVersion((v) => v + 1)
                        })}
                      />
                    ) : (
                      <>
                        <IconButton
                          icon={EyeOff}
                          label={`${t.community.hideAuthor}: ${p.partner ?? p.author ?? t.community.anon}`}
                          onClick={() => {
                            hideAuthor(p.user_id)
                            toast(t.community.authorHidden, { label: t.common.undo, run: () => showAuthor(p.user_id) })
                          }}
                        />
                        <IconButton
                          icon={Flag}
                          label={`${t.community.report} ${p.name}`}
                          onClick={signedIn(async () => {
                            await reportSetup(p.id)
                            toast(t.community.reported)
                          })}
                        />
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {!all && ranked.length > SHOWN && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setAll(true)}>
              {fmt(t.community.seeAll, { n: ranked.length })}
            </Button>
          )}
        </>
      )}
    </CollapsibleCard>
  )
}

/** "12 sessions · 9 h · overall 4.3 · comfort 4.1": exactly what is public. */
function resultsLine(r: PublicResults, t: Dict, lang: string, opts: { hours?: boolean; outOf?: boolean } = {}) {
  const parts = [fmt(t.community.sessions, { n: r.sessions })]
  if (opts.hours) parts.push(fmt(t.community.hours, { h: fmtNum(r.hours, r.hours % 1 ? 1 : 0, lang) }))
  for (const k of SESSION_RATINGS) {
    const v = r.avg[k]
    if (v === undefined) continue
    parts.push(`${t.journal.ratings[k].toLowerCase()} ${fmtNum(v, 1, lang)}${opts.outOf && k === 'overall' ? '/5' : ''}`)
  }
  return parts.join(' · ')
}

/** In the share sheet: publish a saved setup as a recipe, or update it. */
export function PublishSetup({ setup, racket }: { setup: Setup; racket: Racket }) {
  const t = useT()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const account = useStore((s) => s.account)
  const masses = useStore((s) => s.masses)
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  const [open, setOpen] = useState(false)
  const [author, setAuthor] = useState('')
  const profile = useStore((s) => s.profile)
  const [goals, setGoals] = useState<Goal[]>(profile.goals ?? [])
  const [level, setLevel] = useState<Level | ''>(profile.level ?? '')
  const [style, setStyle] = useState<Style | ''>(profile.style ?? '')
  const [withResults, setWithResults] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [publishedAs, setPublishedAs] = useState<string | null>(null)

  // Already published: the form starts from the recipe as it is now.
  useEffect(() => {
    let alive = true
    if (account && communityEnabled())
      myRecipe(setup.id).then((r) => {
        if (!alive || !r) return
        setPublishedAs(r.id)
        setGoals(r.goals)
        setLevel(r.level ?? '')
        setStyle(r.style ?? '')
        setAuthor(r.author ?? '')
        setWithResults(!!r.results)
      })
    return () => {
      alive = false
    }
  }, [account, setup.id])

  if (!communityEnabled() || !racket.isStock) return null

  const results = owned && stringings && sessions ? setupResults(setup.id, owned, stringings, sessions) : null
  const label = publishedAs ? t.community.update : t.community.publish

  if (!open)
    return (
      <Button icon={Users} className="w-full" onClick={() => (account ? setOpen(true) : toast(t.community.needAccount))}>
        {label}
      </Button>
    )
  return (
    <form
      className="space-y-4 border-t border-border pt-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setTried(true)
        if (!goals.length) return
        setBusy(true)
        try {
          const { result } = compute({ spec: racket, ...setup, masses })
          const done = await publishSetup({
            name: setup.name,
            author,
            config: setup,
            racket,
            specs: result,
            goals,
            level: level || undefined,
            style: style || undefined,
            results: withResults ? results : null,
            setupRef: setup.id,
          })
          toast(done === 'updated' ? t.community.updated : done === 'moved' ? t.community.moved : t.community.published)
          setOpen(false)
          setPublishedAs((id) => id ?? 'yes')
        } catch (err) {
          toast(err instanceof HiddenRecipeError ? t.community.hiddenRecipe : err instanceof BlockedWordsError ? t.community.blockedWords : t.community.error)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-muted">{t.community.publishHint}</p>
      <div>
        <MultiChoiceChips label={t.community.goal} value={goals} onChange={setGoals} max={2} options={GOALS.map((g) => ({ value: g, label: t.community.goals[g] }))} />
        {tried && !goals.length && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {t.community.goalNeeded}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select<Level | ''> label={t.community.level} value={level} onChange={setLevel} options={[{ value: '', label: t.community.notSaid }, ...LEVELS.map((l) => ({ value: l, label: t.community.levels[l] }))]} />
        <Select<Style | ''> label={t.community.style} value={style} onChange={setStyle} options={[{ value: '', label: t.community.notSaid }, ...STYLES.map((x) => ({ value: x, label: t.community.styles[x] }))]} />
      </div>
      {results && (
        <div>
          <Toggle label={t.community.includeResults} checked={withResults} onChange={setWithResults} />
          {withResults && <p className="num mt-1 text-sm text-muted">{fmt(t.community.resultsPublic, { line: resultsLine(roundResults(results), t, lang, { hours: true }) })}</p>}
        </div>
      )}
      <TextField label={`${t.community.author} (${t.community.authorHint})`} value={author} onChange={setAuthor} maxLength={30} />
      <Button type="submit" variant="primary" icon={Upload} loading={busy} className="w-full">
        {label}
      </Button>
    </form>
  )
}

/** On the measuring page: add this measurement to the frame's median. */
export function ShareMeasurement({ racket, weightG, balanceCm, swingweight }: { racket: Racket | undefined; weightG?: number; balanceCm?: number; swingweight?: number }) {
  const t = useT()
  const toast = useToast()
  const account = useStore((s) => s.account)
  const [strung, setStrung] = useState(true)
  const [unit, setUnit] = useState<'1' | '2' | '3' | '4'>('1')
  const [busy, setBusy] = useState(false)
  if (!communityEnabled() || !racket || weightG === undefined) return null

  return (
    <Card label={t.community.share}>
      <CardTitle>{t.community.share}</CardTitle>
      {!racket.isStock ? (
        <p className="text-sm text-muted">{t.community.shareCustom}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t.community.shareHint}</p>
          <p className="text-sm">
            {t.community.shareRacket}:{' '}
            <span className="font-medium">
              {racket.brand} {racket.model}
              {racket.year ? ` (${racket.year})` : ''}
            </span>
          </p>
          <Toggle label={t.community.shareStrung} checked={strung} onChange={setStrung} />
          <div>
            <span className="mb-1.5 block text-sm">{t.community.shareUnit}</span>
            <Segmented
              label={t.community.shareUnit}
              value={unit}
              onChange={setUnit}
              options={(['1', '2', '3', '4'] as const).map((u) => ({
                value: u,
                label: fmt(t.community.unitN, { n: u }),
              }))}
            />
          </div>
          <Button
            variant="primary"
            icon={Send}
            loading={busy}
            onClick={async () => {
              if (!account) return toast(t.community.needAccount)
              setBusy(true)
              try {
                await submitMeasurement({
                  racketId: racket.id,
                  strung,
                  unit: Number(unit),
                  weightG,
                  balanceCm,
                  swingweight,
                })
                toast(t.community.shared)
              } catch {
                toast(t.community.error)
              } finally {
                setBusy(false)
              }
            }}
          >
            {t.community.share}
          </Button>
        </div>
      )}
    </Card>
  )
}
