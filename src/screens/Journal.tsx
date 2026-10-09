import { ArrowRight, Bell, NotebookPen, Pencil, Plus, RotateCw, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, uid } from '../data/db'
import { useAllRackets, useSessions, useStringings } from '../data/hooks'
import { FREE_SESSIONS, isPro, useStore } from '../data/store'
import {
  currentStringings,
  dueForRestring,
  insights,
  lifeOf,
  SESSION_RATINGS,
  weeklyHours,
  type Session,
  type Stringing,
} from '../domain/journal'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum, racketLabel } from '../lib/format'
import { Button, Card, CardTitle, cx, EmptyState, IconButton, PageTitle } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { Ring } from '../ui/specs'
import { bedLabel } from '../ui/strings'
import { SessionSheet, StringingSheet } from './JournalSheets'
import { ProGate } from './Pro'
import { useReminders } from './reminders'

const DAY = 86_400_000

export function Journal() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const pro = useStore(isPro)
  const config = useStore((s) => s.config)
  const loadedSetupId = useStore((s) => s.loadedSetupId)
  const stringings = useStringings()
  const sessions = useSessions()
  const rackets = useAllRackets()
  const toast = useToast()
  const [editing, setEditing] = useState<Stringing | null>(null)
  const [logging, setLogging] = useState<Session | null>(null)

  const current = useMemo(() => currentStringings(stringings ?? []), [stringings])
  // One clock per visit keeps the page steady while it re-renders.
  const [now] = useState(() => Date.now())
  if (stringings === undefined || sessions === undefined) return null

  // Built when a button is pressed, so they take the time of the click.
  const blankStringing = (from?: Stringing, at = Date.now()): Stringing => ({
    id: uid(),
    label: from?.label ?? '',
    racketId: from?.racketId ?? config.racketId,
    setupId: from?.setupId ?? loadedSetupId ?? undefined,
    date: at,
    bed: structuredClone(from?.bed ?? config.strings ?? DEFAULT_STRINGBED),
    lifeHours: from?.lifeHours,
    createdAt: at,
    updatedAt: at,
  })
  const blankSession = (at = Date.now()): Session => ({
    id: uid(),
    date: at,
    minutes: 90,
    kind: 'practice',
    stringingId: current[0]?.id,
    ratings: {},
    createdAt: at,
    updatedAt: at,
  })

  const due = dueForRestring(stringings, sessions, now)
  const shown = pro ? sessions : sessions.slice(0, FREE_SESSIONS)
  const byId = new Map(stringings.map((s) => [s.id, s]))

  const removeSession = async (s: Session) => {
    await db.sessions.delete(s.id)
    toast(t.common.deleted, { label: t.common.undo, run: () => void db.sessions.put(s) })
  }

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Button icon={Plus} onClick={() => setEditing(blankStringing())}>
              {t.journal.addStringing}
            </Button>
            <Button variant="primary" icon={Timer} onClick={() => setLogging(blankSession())}>
              {t.journal.logSession}
            </Button>
          </div>
        }
      >
        {t.journal.title}
      </PageTitle>

      {stringings.length === 0 && sessions.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          text={t.journal.intro}
          action={
            <Button variant="primary" icon={Plus} onClick={() => setEditing(blankStringing())}>
              {t.journal.addStringing}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {due.length > 0 && (
            <div role="status" className="space-y-1 rounded-md bg-surface-2 px-4 py-3 text-sm">
              {due.map((s) => (
                <p key={s.id} className="font-semibold">
                  {fmt(t.journal.due, { label: s.label })}
                </p>
              ))}
            </div>
          )}

          {current.length > 0 && (
            <Card label={t.journal.rackets}>
              <CardTitle>{t.journal.rackets}</CardTitle>
              <ul className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                {current.map((st) => {
                  const life = lifeOf(st, sessions, now)
                  const racket = rackets.find((r) => r.id === st.racketId)
                  const days = Math.floor(life.days)
                  const left = Math.round(Math.max(0, 1 - life.used) * 100)
                  return (
                    <li key={st.id} className="flex gap-4">
                      <Ring value={left} label={t.journal.life} color={left > 40 ? 'var(--c-success)' : left > 15 ? 'var(--c-warning)' : 'var(--c-danger)'} />
                      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold">{st.label}</p>
                          <IconButton icon={Pencil} label={`${t.common.edit} ${st.label}`} className="-mr-2 -mt-1.5" onClick={() => setEditing(st)} />
                        </div>
                        {racket && <p className="truncate text-muted">{racketLabel(racket)}</p>}
                        <p className="num">{bedLabel(st.bed, t, lang)}</p>
                        <p className="num text-muted">
                          {days === 0 ? t.journal.strungToday : fmt(t.journal.strungAgo, { n: days })} · {fmt(t.journal.hours, { h: fmtNum(life.hours, 1, lang) })}
                        </p>
                        <p className="num text-muted">{fmt(t.journal.tensionNow, { kg: fmtNum(life.mainsKg, 1, lang) })}</p>
                        <p className={cx('num', life.used >= 1 && 'font-semibold')}>
                          {life.used >= 1 ? t.journal.notifyTitle : fmt(t.journal.left, { h: fmtNum(life.hoursLeft, 0, lang) })}
                        </p>
                        <Button size="sm" icon={RotateCw} className="mt-2" onClick={() => setEditing(blankStringing(st))}>
                          {t.journal.restring}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 text-xs text-muted">{t.journal.lifeHint}</p>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <WeeklyCard sessions={sessions} />
            <Card label={t.journal.insights}>
              <CardTitle>{t.journal.insights}</CardTitle>
              <ProGate title={t.journal.insights} bare>
                <Insights stringings={stringings} sessions={sessions} />
              </ProGate>
            </Card>
          </div>

          <Card label={t.journal.recent}>
            <CardTitle>{t.journal.recent}</CardTitle>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted">{t.journal.noSessions}</p>
            ) : (
              <ul className="divide-y divide-border">
                {shown.map((s) => {
                  const st = s.stringingId ? byId.get(s.stringingId) : undefined
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="num">
                          <span className="font-medium">{t.journal.kinds[s.kind]}</span> · {fmt(t.journal.minutesShort, { n: s.minutes })}
                          {s.ratings.overall !== undefined && <> · {s.ratings.overall}/5</>}
                          {s.armPain && <> · {t.journal.armPain}</>}
                        </p>
                        <p className="truncate text-muted">
                          {fmtDate(s.date, lang)}
                          {st && <> · {st.label}</>}
                        </p>
                      </div>
                      <IconButton icon={Pencil} label={`${t.common.edit} ${t.journal.sessionTitle}`} onClick={() => setLogging(s)} />
                      <IconButton icon={Trash2} label={`${t.common.delete} ${t.journal.sessionTitle}`} onClick={() => removeSession(s)} />
                    </li>
                  )
                })}
              </ul>
            )}
            {!pro && sessions.length > FREE_SESSIONS && <p className="mt-3 text-sm text-muted">{fmt(t.journal.historyLocked, { n: FREE_SESSIONS })}</p>}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <RemindersCard />
            <Card>
              <Link to="/cordas" className="flex items-center justify-between gap-3 text-sm font-semibold">
                {t.journal.equivalentCta}
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </Card>
          </div>
        </div>
      )}

      <StringingSheet value={editing} onClose={() => setEditing(null)} />
      <SessionSheet value={logging} stringings={stringings} onClose={() => setLogging(null)} />
    </>
  )
}

function WeeklyCard({ sessions }: { sessions: Session[] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [now] = useState(() => Date.now())
  const weeks = weeklyHours(sessions, 8, now)
  const max = Math.max(1, ...weeks)
  return (
    <Card label={t.journal.weekly}>
      <CardTitle>{t.journal.weekly}</CardTitle>
      <ul className="flex h-32 items-end gap-2">
        {weeks.map((h, i) => {
          const start = now - (weeks.length - 1 - i) * 7 * DAY
          return (
            <li key={i} className="flex h-full flex-1 flex-col justify-end" aria-label={fmt(t.journal.weeklyLabel, { date: fmtDate(start, lang), h: fmtNum(h, 1, lang) })}>
              <span className="num mb-1 text-center text-[11px] text-muted" aria-hidden>
                {h > 0 ? fmtNum(h, h < 10 ? 1 : 0, lang) : ''}
              </span>
              <span className={cx('block rounded-t-sm', h > 0 ? 'bg-[var(--c-area-journal)]' : 'bg-border')} style={{ height: h > 0 ? `${(h / max) * 70}%` : 2, minHeight: 2 }} aria-hidden />
              <span className="num mt-1.5 text-center text-[10px] text-muted" aria-hidden>
                {new Date(start).getDate()}/{new Date(start).getMonth() + 1}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Insights({ stringings, sessions }: { stringings: Stringing[]; sessions: Session[] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const rows = insights(stringings, sessions).filter((r) => r.avg.overall !== undefined)
  if (rows.length === 0) return <p className="text-sm text-muted">{t.journal.insightsEmpty}</p>
  return (
    <div>
      <p className="mb-3 text-sm text-muted">{t.journal.insightsHint}</p>
      <ol className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.stringing.id} className="py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">
                {r.stringing.label} · <span className="num">{bedLabel(r.stringing.bed, t, lang)}</span>
              </span>
              <span className="readout text-lg">{fmtNum(r.avg.overall, 1, lang)}</span>
            </div>
            <p className="num text-muted">
              {fmtDate(r.stringing.date, lang)} · {r.sessions === 1 ? t.journal.sessionOne : fmt(t.journal.sessions, { n: r.sessions })}
              {SESSION_RATINGS.filter((k) => k !== 'overall' && r.avg[k] !== undefined).map((k) => (
                <span key={k}>
                  {' '}
                  · {t.journal.ratings[k]} {fmtNum(r.avg[k], 1, lang)}
                </span>
              ))}
              {r.armPainShare > 0 && <> · {fmt(t.journal.pain, { n: Math.round(r.armPainShare * 100) })}</>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function RemindersCard() {
  const t = useT()
  const { supported, permission, enable } = useReminders()
  return (
    <Card label={t.journal.reminders}>
      <CardTitle>{t.journal.reminders}</CardTitle>
      <ProGate title={t.journal.reminders} bare>
        <p className="mb-3 text-sm text-muted">{t.journal.remindersHint}</p>
        {!supported ? null : permission === 'granted' ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <Bell className="size-4" aria-hidden /> {t.journal.remindersOn}
          </p>
        ) : permission === 'denied' ? (
          <p className="text-sm text-muted">{t.journal.remindersBlocked}</p>
        ) : (
          <Button icon={Bell} onClick={enable}>
            {t.journal.remindersEnable}
          </Button>
        )}
      </ProGate>
    </Card>
  )
}
