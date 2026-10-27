import { scrollToTop } from '../app/Shell'
import { ArrowRight, Crosshair, EyeOff, Flag, RefreshCw, Send, Trash2, Upload, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { findRacket } from '../data/db'
import { useCustomRackets, useOwned, useSessions, useSetups, useStringings } from '../data/hooks'
import { PRO_TARGETS } from '../data/pros'
import { STOCK_RACKETS } from '../data/rackets'
import { isPro, useStore } from '../data/store'
import { SESSION_RATINGS, setupResults } from '../domain/journal'
import { compute } from '../domain/physics'
import type { Racket, Setup } from '../domain/types'
import { fmt, useT, type Dict } from '../i18n'
import {
  communityEnabled,
  deletePublicSetup,
  filterRecipes,
  measurementStats,
  BlockedWordsError,
  GOALS,
  HiddenRecipeError,
  LEVELS,
  publicSetups,
  myRecipe,
  publishSetup,
  rankPublicSetups,
  REPORT_REASONS,
  reportSetup,
  roundResults,
  setupCounts,
  siblingsOf,
  similarRecipes,
  STYLES,
  submitMeasurement,
  topSetups,
  type Goal,
  type Level,
  type MeasurementStats,
  type PublicResults,
  type PublicSetup,
  type ReportReason,
  type Style,
} from '../lib/community'
import { fmtNum, leadParts } from '../lib/format'
import { Badge, Button, Card, CardTitle, ChoiceChips, IconButton, MultiChoiceChips, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { CollapsibleCard, InfoTip } from '../ui/disclosure'
import { Sheet, useToast } from '../ui/overlay'
import { bedLabel } from '../lib/bedLabel'
import { useUnits } from '../lib/units'
import type { MatchHandoff } from './Match'
import { usePaywall } from './Pro'

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

const OPEN_RECIPES = 'swingmath:open-recipes'
let recipesAsked = false

/** Opens the calculator's recipes sheet: now, or as soon as it shows (from
 *  the library, the calculator is still loading). */
export function openRecipes() {
  recipesAsked = true
  window.dispatchEvent(new Event(OPEN_RECIPES))
}

/** Under the racket picker: "3 community setups for this racket →". */
export function CommunityLink({ racket }: { racket: Racket }) {
  const t = useT()
  const n = useSetupCounts().get(racket.id) ?? 0
  if (!communityEnabled() || !racket.isStock || n < 1) return null
  return (
    <button
      type="button"
      onClick={openRecipes}
      className="-mx-1 flex min-h-9 items-center gap-1 rounded-md px-1 text-sm text-muted hover:bg-surface-2 hover:text-text"
    >
      <Users className="size-4 shrink-0" aria-hidden />
      {n === 1 ? t.community.forRacketOne : fmt(t.community.forRacket, { n })}
      <ArrowRight className="size-4 shrink-0" aria-hidden />
    </button>
  )
}

/** Recipes the card shows; the rest are in the sheet. */
const SHOWN = 3

/** This frame's recipes and its other versions', the authors the player hid
 *  left out. Undefined while loading. */
function useRecipes(racket: Racket, version: number) {
  const hidden = useStore((s) => s.hiddenAuthors)
  const siblings = useMemo(() => siblingsOf(racket, STOCK_RACKETS), [racket])
  // What came back, and for which frames: another frame's list is no list.
  const key = `${[racket.id, ...siblings].join()}#${version}`
  const [got, setGot] = useState<{ key: string; list: PublicSetup[] }>()
  useEffect(() => {
    let alive = true
    publicSetups([racket.id, ...siblings]).then((list) => alive && setGot({ key, list }))
    return () => {
      alive = false
    }
  }, [key, racket.id, siblings])
  const setups = got?.key === key ? got.list : undefined
  return { list: setups?.filter((p) => !hidden.includes(p.author_key)), siblings }
}

/** Calculator card: what players measured, and the first recipes; all of
 *  them open in a sheet. */
export function CommunityCard({ racket }: { racket: Racket }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [got, setGot] = useState<{ id: string; stats: MeasurementStats[] }>()
  const [version, setVersion] = useState(0)
  const { list, siblings } = useRecipes(racket, version)
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    let alive = true
    measurementStats(racket.id).then((stats) => alive && setGot({ id: racket.id, stats }))
    return () => {
      alive = false
    }
  }, [racket.id])
  const stats = got?.id === racket.id ? got.stats : undefined

  // Asked for before the calculator showed, or while it shows.
  useEffect(() => {
    const open = () => {
      recipesAsked = false
      setSheet(true)
    }
    if (recipesAsked) open()
    window.addEventListener(OPEN_RECIPES, open)
    return () => window.removeEventListener(OPEN_RECIPES, open)
  }, [])

  if (!communityEnabled() || !racket.isStock) return null

  const here = (list ?? []).filter((p) => p.racket_id === racket.id)
  const first = rankPublicSetups(list ?? [], undefined, racket.id).slice(0, SHOWN)
  const measured = (stats ?? []).reduce((n, x) => n + x.n, 0)
  const changed = () => setVersion((v) => v + 1)
  return (
    <>
      <CollapsibleCard
        id="community"
        title={t.community.title}
        summary={[measured ? fmt(t.community.measuredShort, { n: measured }) : '', here.length ? fmt(t.community.setupsShort, { n: here.length }) : ''].filter(Boolean).join(' · ') || undefined}
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

        <h3 className="mb-1 mt-4 text-sm font-medium">{t.community.setups}</h3>
        {list === undefined ? null : (
          <>
            {list.length === 0 ? <p className="text-sm text-muted">{t.community.noSetups}</p> : <RecipeList list={first} racket={racket} onChange={changed} />}
            <Button icon={Users} className="mt-2 w-full" onClick={() => setSheet(true)}>
              {list.length ? fmt(t.community.seeRecipes, { n: list.length }) : t.community.seeSimilar}
            </Button>
          </>
        )}
      </CollapsibleCard>
      {/* Outside the card: a folded card does not render what it holds. */}
      <RecipesSheet open={sheet} onClose={() => setSheet(false)} racket={racket} list={list} siblings={siblings} onChange={changed} />
    </>
  )
}

/** All of a frame's recipes, with filters; the pros who play it; and, while
 *  it has none, recipes on frames that feel like it. */
function RecipesSheet({
  open,
  onClose,
  racket,
  list,
  siblings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  racket: Racket
  list: PublicSetup[] | undefined
  siblings: string[]
  onChange: () => void
}) {
  const t = useT()
  const myGoal = useStore((s) => s.profile.goals?.[0])
  const hidden = useStore((s) => s.hiddenAuthors)
  const custom = useCustomRackets()
  const [goal, setGoal] = useState<Goal | 'all'>('all')
  const [level, setLevel] = useState<Level | ''>('')
  const [style, setStyle] = useState<Style | ''>('')
  const [top, setTop] = useState<PublicSetup[]>()

  // Each time it opens: the player's goal, if this frame has recipes for it.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setGoal(myGoal && list?.some((p) => p.goals.includes(myGoal)) ? myGoal : 'all')
      setLevel('')
      setStyle('')
    }
  }
  const empty = list !== undefined && list.length === 0
  useEffect(() => {
    let alive = true
    if (open && empty) topSetups().then((s) => alive && setTop(s))
    return () => {
      alive = false
    }
  }, [open, empty])

  const all = list ?? []
  const goalsHere = GOALS.filter((g) => all.some((p) => p.goals.includes(g)))
  const levelsHere = LEVELS.filter((l) => all.some((p) => p.level === l))
  const stylesHere = STYLES.filter((x) => all.some((p) => p.style === x))
  const shown = rankPublicSetups(filterRecipes(all, { goal: goal === 'all' ? undefined : goal, level: level || undefined, style: style || undefined }), undefined, racket.id)
  const frameOf = (p: PublicSetup) => findRacket(p.racket_id, custom) ?? p.racket ?? undefined
  const similar = empty && top ? similarRecipes(top.filter((p) => !hidden.includes(p.author_key)), racket, siblings, frameOf) : []
  const clear = () => {
    setGoal('all')
    setLevel('')
    setStyle('')
  }

  return (
    <Sheet open={open} onClose={onClose} title={fmt(t.community.recipesFor, { name: `${racket.brand} ${racket.model}` })}>
      <div className="space-y-5">
        <ProsOnFrame ids={[racket.id, ...siblings]} />
        {all.length > 1 && (goalsHere.length > 0 || levelsHere.length > 0 || stylesHere.length > 0) && (
          // Selects, not chips: three filters in one or two lines on a phone.
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {goalsHere.length > 0 && (
              <Select<Goal | 'all'> label={t.community.goalFilter} value={goal} onChange={setGoal} options={[{ value: 'all', label: t.community.all }, ...goalsHere.map((g) => ({ value: g, label: t.community.goals[g] }))]} />
            )}
            {levelsHere.length > 0 && (
              <Select<Level | ''> label={t.community.level} value={level} onChange={setLevel} options={[{ value: '', label: t.community.all }, ...levelsHere.map((l) => ({ value: l, label: t.community.levels[l] }))]} />
            )}
            {stylesHere.length > 0 && (
              <Select<Style | ''> label={t.community.style} value={style} onChange={setStyle} options={[{ value: '', label: t.community.all }, ...stylesHere.map((x) => ({ value: x, label: t.community.styles[x] }))]} />
            )}
          </div>
        )}
        {list === undefined ? null : empty ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {t.community.noSetups} {t.community.publishFirst}
            </p>
            {similar.length > 0 && (
              <section className="space-y-1" aria-label={t.community.similarTitle}>
                <h3 className="text-sm font-medium">{t.community.similarTitle}</h3>
                <p className="text-sm text-muted">{t.community.similarHint}</p>
                <RecipeList list={similar} racket={racket} onChange={onChange} onDone={onClose} />
              </section>
            )}
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">
            {t.community.noMatch}{' '}
            <button type="button" className="underline underline-offset-2 hover:text-text" onClick={clear}>
              {t.community.clearFilters}
            </button>
          </p>
        ) : (
          <RecipeList list={shown} racket={racket} onChange={onChange} onDone={onClose} />
        )}
      </div>
    </Sheet>
  )
}

/** The pros whose frame is this one (or another version of it): each opens
 *  Planear with the pro as the target, as Compare does. Pros are Pro. */
function ProsOnFrame({ ids }: { ids: string[] }) {
  const t = useT()
  const nav = useNavigate()
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const setLastPro = useStore((s) => s.setLastPro)
  const pros = PRO_TARGETS.filter((p) => p.baseRacketId && ids.includes(p.baseRacketId))
  if (!pros.length) return null
  return (
    <section className="space-y-2" aria-label={t.community.prosHere}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {t.community.prosHere} {!pro && <Badge tone="pro">Pro</Badge>}
      </h3>
      <p className="text-sm text-muted">{t.community.prosHint}</p>
      <div className="flex flex-wrap gap-2">
        {pros.map((p) => (
          <Button
            key={p.id}
            size="sm"
            icon={Crosshair}
            onClick={() => {
              setLastPro(p.id)
              if (!pro) return paywall('pros', { asked: true })
              const handoff: MatchHandoff = { from: 'calc', pro: p.id, run: true }
              nav('/match', { state: handoff })
            }}
          >
            {p.player}
          </Button>
        ))}
      </div>
    </section>
  )
}

/**
 * Recipes as rows: the lead first, then the numbers and what the recipe is
 * for. A recipe for this frame is tried on; one for another frame is reached
 * from the player's own with Planear, or tried on that frame.
 */
function RecipeList({ list, racket, onChange, onDone }: { list: PublicSetup[]; racket: Racket; onChange: () => void; onDone?: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const u = useUnits()
  const nav = useNavigate()
  const account = useStore((s) => s.account)
  const loadConfig = useStore((s) => s.loadConfig)
  const masses = useStore((s) => s.masses)
  const hideAuthor = useStore((s) => s.hideAuthor)
  const showAuthor = useStore((s) => s.showAuthor)
  const mySetups = useSetups()
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  const custom = useCustomRackets()
  const toast = useToast()
  // The recipe whose report form is open, and the reason picked.
  const [reporting, setReporting] = useState<string | null>(null)
  const [reason, setReason] = useState<ReportReason>('offensive')

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
      onChange()
    })

  // On with a recipe, on its own frame, keeping what was in the calculator for Undo.
  const tryOn = (p: PublicSetup) => {
    const { config, loadedSetupId, triedRecipe } = useStore.getState()
    loadConfig({ ...p.config, racketId: p.racket_id }, null, p.id)
    toast(t.community.tried, { label: t.common.undo, run: () => loadConfig(config, loadedSetupId, triedRecipe) })
    onDone?.()
    scrollToTop()
  }

  // Planear, from the calculator's setup to this recipe's numbers.
  const reach = (p: PublicSetup) => {
    const frame = findRacket(p.racket_id, custom) ?? p.racket
    if (!frame) return
    const handoff: MatchHandoff = {
      from: 'calc',
      recipe: {
        id: p.id,
        name: p.name,
        frame: { headSizeSqIn: frame.headSizeSqIn, lengthCm: frame.lengthCm },
        specs: { weightG: p.specs.weightG, balanceCm: p.specs.balanceCm, swingweight: p.specs.swingweight },
        strung: p.config.accessories.strings,
      },
      run: true,
    }
    onDone?.()
    nav('/match', { state: handoff })
  }

  return (
    <ul className="divide-y divide-border">
      {list.map((p) => {
        const mine = p.mine
        const local = mine && p.setup_ref ? mySetups?.find((x) => x.id === p.setup_ref) : undefined
        const elsewhere = p.racket_id !== racket.id
        const frame = elsewhere ? (findRacket(p.racket_id, custom) ?? p.racket) : racket
        const lead = leadParts(p.config, t, lang)
        const tags = [
          ...p.goals.map((g) => t.community.goals[g]),
          p.level && t.community.levels[p.level],
          p.style && t.community.styles[p.style],
          p.config.baseMode === 'measured' ? t.community.baseMeasured : t.community.baseCatalog,
        ].filter(Boolean) as string[]
        return (
          <li key={p.id} className="flex flex-col gap-2 py-3">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-medium">
                {p.name}{' '}
                {p.partner ? (
                  <Badge tone="accent">{fmt(t.community.partner, { name: p.partner })}</Badge>
                ) : (
                  <span className="font-normal text-muted">· {p.author || t.community.anon}</span>
                )}
              </p>
              {elsewhere && frame && <p className="text-muted">{fmt(t.community.onFrame, { name: `${frame.brand} ${frame.model}${frame.year ? ` (${frame.year})` : ''}` })}</p>}
              <p className="readout">{lead.length ? lead.join(' · ') : t.setups.noLead}</p>
              <p className="num text-muted">
                {u.weight(p.specs.weightG)} {u.weightUnit} · {u.balance(p.specs.balanceCm)} {u.balanceUnit} · SW {fmtNum(p.specs.swingweight, 0, lang)}
                {p.config.strings && ` · ${bedLabel(p.config.strings, t, lang)}`}
              </p>
              <p className="flex flex-wrap items-center gap-1">
                {tags.map((x) => (
                  <Badge key={x}>{x}</Badge>
                ))}
                {p.copies > 0 && <span className="num text-xs text-muted">{p.copies === 1 ? t.community.copyOne : fmt(t.community.copies, { n: p.copies })}</span>}
              </p>
              {p.results && (
                <p className="num text-xs text-muted">
                  {resultsLine(p.results, t, lang, { outOf: true })} ({t.community.fromJournal})
                </p>
              )}
              {mine && p.hidden && <p className="text-danger">{t.community.hiddenMine}</p>}
              {reporting === p.id && (
                <form
                  className="space-y-3 rounded-md bg-surface-2 p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void signedIn(async () => {
                      await reportSetup(p.id, reason)
                      setReporting(null)
                      toast(t.community.reported)
                    })()
                  }}
                >
                  <ChoiceChips<ReportReason>
                    label={fmt(t.community.reportWhy, { name: p.name })}
                    value={reason}
                    onChange={setReason}
                    options={REPORT_REASONS.map((r) => ({ value: r, label: t.community.reasons[r] }))}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="primary" icon={Flag}>
                      {t.community.report}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReporting(null)}>
                      {t.common.cancel}
                    </Button>
                  </div>
                </form>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {elsewhere ? (
                <>
                  <Button size="sm" variant="primary" icon={Crosshair} onClick={() => reach(p)} aria-label={`${t.community.reach}: ${p.name}`}>
                    {t.community.reach}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => tryOn(p)} aria-label={`${t.community.tryOnFrame}: ${p.name}`}>
                    {t.community.tryOnFrame}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => tryOn(p)}>
                  {t.community.tryIt}
                </Button>
              )}
              {local && !p.hidden && (
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={update(p, local)}>
                  {t.community.updateMine}
                </Button>
              )}
              <span className="ml-auto flex items-center gap-1">
                {mine ? (
                  <IconButton
                    icon={Trash2}
                    label={`${t.community.remove} ${p.name}`}
                    onClick={signedIn(async () => {
                      await deletePublicSetup(p.id)
                      onChange()
                    })}
                  />
                ) : (
                  <>
                    <IconButton
                      icon={EyeOff}
                      label={`${t.community.hideAuthor}: ${p.partner ?? p.author ?? t.community.anon}`}
                      onClick={() => {
                        hideAuthor(p.author_key)
                        toast(t.community.authorHidden, { label: t.common.undo, run: () => showAuthor(p.author_key) })
                      }}
                    />
                    <IconButton
                      icon={Flag}
                      label={`${t.community.report} ${p.name}`}
                      active={reporting === p.id}
                      aria-expanded={reporting === p.id}
                      onClick={() => {
                        if (!account) return toast(t.community.needAccount)
                        setReason('offensive')
                        setReporting((id) => (id === p.id ? null : p.id))
                      }}
                    />
                  </>
                )}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
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
  const [hiddenByReports, setHiddenByReports] = useState(false)

  // Already published: the form starts from the recipe as it is now.
  useEffect(() => {
    let alive = true
    if (account && communityEnabled())
      myRecipe(setup.id).then((r) => {
        if (!alive || !r) return
        setPublishedAs(r.id)
        setHiddenByReports(r.hidden)
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

  // Hidden by reports: nothing to publish until it is reviewed.
  if (hiddenByReports) return <p className="text-sm text-danger">{t.community.hiddenRecipe}</p>
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
