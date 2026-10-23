import { ArrowRight, Check, Plus, RotateCw, Timer } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { saveOwned, uid } from '../data/db'
import { useAllRackets, useOwned, useSessions, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { hoursOn, insights, isFinished, latestOf, lifeOf, ownerKey, SESSION_KINDS, weeklyHours, type OwnedRacket, type Session, type SessionKind, type Stringing } from '../domain/journal'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'
import { Button, Card, CardTitle, ChoiceChips, cx, PageTitle } from '../ui/basics'
import { InfoTip } from '../ui/disclosure'
import { bedLabel } from '../ui/strings'
import { LifeBar, OwnedSheet, RacketSheet, SessionList, SessionSheet, StringingSheet } from './JournalSheets'
import { RestringReminderSheet, StringingReportSheet } from './JournalReport'
import { MeasurementSheet } from './MeasurementSheet'
import { ProGate } from './Pro'

const DAY = 86_400_000
const WEEK = 7 * DAY

/** Monday 00:00 of the week `ms` falls in (local time). */
function weekStart(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export function Journal() {
  const t = useT()
  const config = useStore((s) => s.config)
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  const [editingOwned, setEditingOwned] = useState<OwnedRacket | null>(null)
  const [viewing, setViewing] = useState<OwnedRacket | null>(null)
  const [stringing, setStringing] = useState<Stringing | null>(null)
  const [logging, setLogging] = useState<Session | null>(null)
  const [report, setReport] = useState<Stringing | null>(null)
  const [measuring, setMeasuring] = useState<OwnedRacket | null>(null)
  // One clock per visit keeps the page steady while it re-renders.
  const [now] = useState(() => Date.now())

  const loading = owned === undefined || stringings === undefined || sessions === undefined
  const active = useMemo(() => (owned ?? []).filter((o) => !o.retired), [owned])
  // A restring reminder the player tapped (lib/platform.ts, reminderPath).
  const [params, setParams] = useSearchParams()
  const reminderId = params.get('lembrete')
  const reminder = reminderId ? stringings?.find((s) => s.id === reminderId) : undefined
  const reminderOwned = reminder && active.find((o) => o.id === reminder.ownedId)
  const closeReminder = () => setParams({}, { replace: true })

  // Built when a button is pressed, so they take the time of the click.
  const newOwned = (at = Date.now()): OwnedRacket => ({ id: uid(), name: '', racketId: config.racketId, createdAt: at, updatedAt: at })
  const restring = (o: OwnedRacket, at = Date.now()): Stringing => {
    const last = latestOf(o.id, stringings ?? [])
    return {
      id: uid(),
      ownedId: o.id,
      label: o.name,
      racketId: o.racketId,
      setupId: o.setupId,
      date: at,
      bed: structuredClone(last?.bed ?? config.strings ?? DEFAULT_STRINGBED),
      lifeHours: last?.lifeHours,
      createdAt: at,
      updatedAt: at,
    }
  }
  const newSession = (at = Date.now()): Session => {
    // The racket played last, else the first one.
    const last = sessions?.find((s) => s.stringingId)
    const lastOwned = last && stringings?.find((s) => s.id === last.stringingId)?.ownedId
    const pick = active.find((o) => o.id === lastOwned) ?? active[0]
    return { id: uid(), date: at, minutes: last?.minutes ?? 90, kind: last?.kind ?? 'practice', stringingId: pick && latestOf(pick.id, stringings ?? [])?.id, ratings: {}, createdAt: at, updatedAt: at }
  }

  const sheets = (
    <>
      {editingOwned && <OwnedSheet value={editingOwned} onClose={() => setEditingOwned(null)} />}
      {stringing && (
        <StringingSheet
          value={stringing}
          owned={owned ?? []}
          onClose={() => setStringing(null)}
          onRestrung={(st) => setReport(previousOf(st, stringings ?? [], sessions ?? []) ?? null)}
        />
      )}
      {measuring && <MeasurementSheet owned={[measuring]} ownedId={measuring.id} value={{}} onClose={() => setMeasuring(null)} />}
      {reminder &&
        // An old reminder of strings since replaced: how they went.
        (isFinished(reminder, stringings ?? []) ? (
          <StringingReportSheet value={reminder} stringings={stringings ?? []} sessions={sessions ?? []} owned={owned ?? []} onClose={closeReminder} />
        ) : (
          <RestringReminderSheet
            value={reminder}
            stringings={stringings ?? []}
            sessions={sessions ?? []}
            owned={owned ?? []}
            onRestring={reminderOwned ? () => (closeReminder(), setStringing(restring(reminderOwned))) : undefined}
            onRetire={reminderOwned ? () => void saveOwned({ ...reminderOwned, retired: true, updatedAt: Date.now() }).then(closeReminder) : undefined}
            onReport={() => (closeReminder(), setReport(reminder))}
            onClose={closeReminder}
          />
        ))}
      {report && <StringingReportSheet value={report} stringings={stringings ?? []} sessions={sessions ?? []} owned={owned ?? []} onClose={() => setReport(null)} />}
      {logging && <SessionSheet value={logging} stringings={stringings ?? []} owned={owned ?? []} onClose={() => setLogging(null)} />}
      {viewing && (
        <RacketSheet
          value={(owned ?? []).find((o) => o.id === viewing.id) ?? viewing}
          stringings={stringings ?? []}
          sessions={sessions ?? []}
          onClose={() => setViewing(null)}
          onEdit={(o) => (setViewing(null), setEditingOwned(o))}
          onRestring={(o) => (setViewing(null), setStringing(restring(o)))}
          onEditStringing={(s) => (setViewing(null), setStringing(s))}
          onEditSession={(s) => (setViewing(null), setLogging(s))}
          onReport={(s) => (setViewing(null), setReport(s))}
          onMeasure={(o) => (setViewing(null), setMeasuring(o))}
        />
      )}
    </>
  )

  const logButton = (
    <Button variant="primary" icon={Timer} onClick={() => setLogging(newSession())} disabled={loading}>
      {t.journal.logSession}
    </Button>
  )

  if (loading)
    return (
      <>
        <PageTitle>{t.journal.title}</PageTitle>
        <div className="space-y-3" aria-busy="true">
          <div className="h-36 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
        </div>
      </>
    )

  // First time: add a racket, then log a session.
  if (active.length === 0 && sessions.length === 0)
    return (
      <>
        <PageTitle subtitle={t.journal.intro}>{t.journal.title}</PageTitle>
        <ol className="space-y-3">
          <Step n={1} title={t.journal.step1} hint={t.journal.step1Hint}>
            <Button variant="primary" icon={Plus} onClick={() => setEditingOwned(newOwned())}>
              {t.journal.addRacket}
            </Button>
          </Step>
          <Step n={2} title={t.journal.step2} hint={t.journal.step2Hint} muted />
        </ol>
        {sheets}
      </>
    )

  const shown = sessions

  return (
    <>
      <PageTitle action={<div className="hidden lg:block">{logButton}</div>}>{t.journal.title}</PageTitle>

      <div className="space-y-6">
        <section aria-label={t.journal.myRackets}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-md font-semibold tracking-tight">
              {t.journal.myRackets}
              <InfoTip title={t.journal.life}>{t.journal.lifeHint}</InfoTip>
            </h2>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEditingOwned(newOwned())}>
              {t.journal.addRacket}
            </Button>
          </div>
          {/* Swipe through them on a phone; a grid on wider screens. */}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
            {active.map((o) => (
              // One racket takes the width; more peek out, to swipe.
              <li key={o.id} className={cx('min-w-0 shrink-0 snap-start md:w-auto', active.length === 1 ? 'w-full' : 'w-[82%]')}>
                <RacketCard owned={o} stringings={stringings} sessions={sessions} now={now} onOpen={() => setViewing(o)} onRestring={() => setStringing(restring(o))} />
              </li>
            ))}
          </ul>
        </section>

        {/* Numbers once there is a session to count: zeros would look broken. */}
        {sessions.length > 0 && <Summary sessions={sessions} stringings={stringings} owned={owned} now={now} />}

        <section aria-label={t.journal.recent}>
          <h2 className="mb-1 text-md font-semibold tracking-tight">{t.journal.recent}</h2>
          {sessions.length === 0 ? (
            <p className="py-3 text-sm text-muted">{t.journal.noSessions}</p>
          ) : (
            <Timeline sessions={shown} stringings={stringings} owned={owned} now={now} onOpen={setLogging} onReport={setReport} />
          )}
        </section>

        <Card label={t.journal.insights}>
          <CardTitle info={<InfoTip title={t.journal.insights}>{t.journal.insightsHint}</InfoTip>}>{t.journal.insights}</CardTitle>
          <ProGate title={t.journal.insights} reason="journal" bare>
            <Insights stringings={stringings} sessions={sessions} owned={owned} />
          </ProGate>
        </Card>

        <Link to="/cordas" className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-surface-2">
          {t.journal.equivalentCta}
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>

      {/* Phones: logging a session is always one tap away. */}
      <div className="fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] right-4 z-20 lg:hidden">
        <Button variant="primary" icon={Timer} className="h-12 rounded-full px-5 shadow-pop" onClick={() => setLogging(newSession())}>
          {t.journal.logSession}
        </Button>
      </div>
      <div className="h-16 lg:hidden" />
      {sheets}
    </>
  )
}

function Step({ n, title, hint, muted, children }: { n: number; title: string; hint: string; muted?: boolean; children?: ReactNode }) {
  return (
    // A step still to come: dashed and muted, never faded below readable contrast.
    <li className={cx('flex gap-4 rounded-lg border border-border p-4', muted && 'border-dashed')}>
      <span aria-hidden className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold">
        {n}
      </span>
      <div className="min-w-0 space-y-2">
        <p className={cx('font-semibold', muted && 'text-muted')}>{title}</p>
        <p className="text-sm text-muted">{hint}</p>
        {children}
      </div>
    </li>
  )
}

/** One racket: its strings' life first, then what is on it, then restring. */
function RacketCard({
  owned,
  stringings,
  sessions,
  now,
  onOpen,
  onRestring,
}: {
  owned: OwnedRacket
  stringings: Stringing[]
  sessions: Session[]
  now: number
  onOpen: () => void
  onRestring: () => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const rackets = useAllRackets()
  const racket = rackets.find((r) => r.id === owned.racketId)
  const st = latestOf(owned.id, stringings)
  const life = st ? lifeOf(st, sessions, now, stringings) : undefined
  const days = life ? Math.floor(life.days) : 0
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        {/* The name opens the racket's history; its tap area covers the card. */}
        <h3 className="truncate font-semibold">
          <button type="button" onClick={onOpen} className="text-left before:absolute before:inset-0 before:rounded-lg">
            {owned.name}
          </button>
        </h3>
        {racket && (
          <p className="truncate text-sm text-muted">
            {racket.brand} {racket.model}
          </p>
        )}
      </div>
      {life && st ? (
        <>
          <LifeBar life={life} compact />
          <p className="num text-sm text-muted wrap-anywhere">
            {bedLabel(st.bed, t, lang)} · {days === 0 ? t.journal.strungToday : fmt(t.journal.strungAgo, { n: days })} · {fmt(t.journal.hours, { h: fmtNum(life.hours, 1, lang) })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">{t.journal.noStrings}</p>
      )}
      <div className="relative mt-auto">
        <Button size="sm" variant={life && life.used >= 1 ? 'primary' : 'secondary'} icon={RotateCw} onClick={onRestring}>
          {t.journal.addStringing}
        </Button>
      </div>
    </article>
  )
}

/** This week at a glance, and the last eight weeks as bars. */
function Summary({ sessions, stringings, owned, now }: { sessions: Session[]; stringings: Stringing[]; owned: OwnedRacket[]; now: number }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const thisWeek = sessions.filter((s) => s.date >= weekStart(now))
  const hoursWeek = thisWeek.reduce((h, s) => h + s.minutes / 60, 0)
  const month = sessions.filter((s) => s.date >= now - 30 * DAY)
  const rated = month.map((s) => s.ratings.overall).filter((v): v is number => v !== undefined)
  const best = insights(stringings, sessions).find((i) => i.avg.overall !== undefined)
  const bestName = best && (best.stringings.length > 1 ? bedLabel(best.stringing.bed, t, lang) : (owned.find((o) => o.id === best.stringing.ownedId)?.name ?? best.stringing.label))
  const weeks = weeklyHours(sessions, 8, now)
  const max = Math.max(1, ...weeks)
  return (
    <section aria-label={t.journal.weekly} className="rounded-lg border border-border p-4">
      <dl className="num grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted">{t.journal.statWeek}</dt>
          <dd className="readout text-2xl">{fmtNum(hoursWeek, 1, lang)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t.journal.stat30}</dt>
          <dd className="readout text-2xl">{month.length}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">{t.journal.statAvg}</dt>
          <dd className="readout text-2xl">{rated.length ? fmtNum(rated.reduce((a, b) => a + b, 0) / rated.length, 1, lang) : '—'}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex h-16 items-end gap-1.5" aria-label={t.journal.weekly}>
        {weeks.map((h, i) => {
          const start = weekStart(now) - (weeks.length - 1 - i) * WEEK
          return (
            <li key={i} className="flex h-full flex-1 flex-col justify-end" aria-label={fmt(t.journal.weeklyLabel, { date: fmtDate(start, lang), h: fmtNum(h, 1, lang) })}>
              <span
                aria-hidden
                className={cx('block rounded-sm', h > 0 ? 'bg-(--c-area-journal)' : 'bg-border', i === weeks.length - 1 && h > 0 && 'opacity-100', i !== weeks.length - 1 && 'opacity-70')}
                style={{ height: h > 0 ? `${Math.max(8, (h / max) * 100)}%` : 3 }}
              />
            </li>
          )
        })}
      </ul>
      <p className="mt-1.5 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{t.journal.weeksAgo}</span>
        <span>{t.journal.thisWeek}</span>
      </p>
      {bestName && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm">
          <Check className="size-4 shrink-0 text-success" aria-hidden />
          {fmt(t.journal.bestSoFar, { name: bestName })}
        </p>
      )}
    </section>
  )
}

/** The stringing a new one replaced on the same racket, if it was played. */
function previousOf(st: Stringing, all: Stringing[], sessions: Session[]) {
  const prev = all
    .filter((o) => o.id !== st.id && ownerKey(o) === ownerKey(st) && (o.date < st.date || (o.date === st.date && o.createdAt < st.createdAt)))
    .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)[0]
  return prev && hoursOn(prev.id, sessions) > 0 ? prev : undefined
}

/**
 * Sessions grouped by week, newest first, each week with its totals. A
 * restring shows in its week, with the report on the strings it replaced.
 */
function Timeline({
  sessions,
  stringings,
  owned,
  now,
  onOpen,
  onReport,
}: {
  sessions: Session[]
  stringings: Stringing[]
  owned: OwnedRacket[]
  now: number
  onOpen: (s: Session) => void
  onReport: (st: Stringing) => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const groups = useMemo(() => {
    const m = new Map<number, { sessions: Session[]; restrings: { st: Stringing; prev: Stringing }[] }>()
    const week = (ms: number) => {
      const w = weekStart(ms)
      if (!m.has(w)) m.set(w, { sessions: [], restrings: [] })
      return m.get(w)!
    }
    for (const s of sessions) week(s.date).sessions.push(s)
    for (const st of stringings) {
      const prev = previousOf(st, stringings, sessions)
      if (prev) week(st.date).restrings.push({ st, prev })
    }
    return [...m].sort((a, b) => b[0] - a[0])
  }, [sessions, stringings])
  const thisWeek = weekStart(now)
  return (
    <div className="space-y-4">
        {groups.map(([w, { sessions: list, restrings }]) => {
          const h = list.reduce((a, s) => a + s.minutes / 60, 0)
          const title = w === thisWeek ? t.journal.thisWeek : w === thisWeek - WEEK ? t.journal.lastWeek : fmt(t.journal.weekOf, { date: fmtDate(w, lang) })
          return (
            <div key={w}>
              <h3 className="num flex items-baseline justify-between gap-2 border-b border-border pb-1.5 text-sm">
                <span className="font-semibold">{title}</span>
                <span className="text-muted">{fmt(list.length === 1 ? t.journal.weekSummaryOne : t.journal.weekSummary, { n: list.length, h: fmtNum(h, 1, lang) })}</span>
              </h3>
              {restrings.map(({ st, prev }) => (
                <button key={st.id} type="button" onClick={() => onReport(prev)} className="flex w-full items-center gap-3 border-b border-border py-2.5 text-left text-sm">
                  <RotateCw className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{fmt(t.journal.restrung, { name: owned.find((o) => o.id === st.ownedId)?.name ?? st.label })}</span>
                    <span className="block text-accent-text">{t.journal.prevReport}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                </button>
              ))}
              <SessionList sessions={list} stringings={stringings} owned={owned} onOpen={onOpen} />
            </div>
          )
        })}
    </div>
  )
}

/** Which racket and strings played best, by the session ratings. */
function Insights({ stringings, sessions, owned }: { stringings: Stringing[]; sessions: Session[]; owned: OwnedRacket[] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [kind, setKind] = useState<SessionKind | 'all'>('all')
  // Only sessions on live strings: dead strings say nothing about the strings.
  const rows = insights(stringings, sessions, { kind: kind === 'all' ? undefined : kind, withinLife: true }).filter((r) => r.avg.overall !== undefined)
  const filter = (
    <ChoiceChips
      label={t.journal.kindFilter}
      value={kind}
      onChange={setKind}
      options={[{ value: 'all' as const, label: t.journal.allKinds }, ...SESSION_KINDS.map((k) => ({ value: k, label: t.journal.kinds[k] }))]}
    />
  )
  if (rows.length === 0)
    return (
      <div className="space-y-3">
        {kind !== 'all' && filter}
        <p className="text-sm text-muted">{t.journal.insightsEmpty}</p>
      </div>
    )
  return (
    <div className="space-y-4">
    {filter}
    <ol className="space-y-3">
      {rows.map((r) => {
        // The same strings on several stringings: one row, under their name.
        const many = r.stringings.length > 1
        const name = owned.find((o) => o.id === r.stringing.ownedId)?.name ?? r.stringing.label
        return (
          <li key={r.stringing.id} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {many ? (
                  <span className="num font-semibold">{bedLabel(r.stringing.bed, t, lang)}</span>
                ) : (
                  <>
                    <span className="font-semibold">{name}</span> · <span className="num">{bedLabel(r.stringing.bed, t, lang)}</span>
                  </>
                )}
              </span>
              <span className="readout shrink-0 text-lg">{fmtNum(r.avg.overall, 1, lang)}</span>
            </div>
            <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${((r.avg.overall ?? 0) / 5) * 100}%` }} />
            </div>
            <p className="num mt-1 text-xs text-muted">
              {many ? fmt(t.journal.stringingsN, { n: r.stringings.length }) : fmtDate(r.stringing.date, lang)} · {r.sessions === 1 ? t.journal.sessionOne : fmt(t.journal.sessions, { n: r.sessions })}
              {r.armPainShare > 0 && <> · {fmt(t.journal.pain, { n: Math.round(r.armPainShare * 100) })}</>}
              {r.noise && (
                <>
                  {' · '}
                  <span className="font-medium">{t.journal.noise}</span>
                </>
              )}
            </p>
          </li>
        )
      })}
    </ol>
    <p className="text-xs text-muted">{t.journal.withinLife}</p>
    </div>
  )
}
