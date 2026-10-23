import { Archive, RotateCw, Sparkles } from 'lucide-react'
import { isPro, useStore } from '../data/store'
import { isFinished, lifeOf, nextStringing, REPORT_BLOCK_HOURS, SESSION_RATINGS, stringingReport, type NextStringing, type OwnedRacket, type Session, type Stringing, type StringingReport } from '../domain/journal'
import { fmt, useT, type Dict } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'
import { Button } from '../ui/basics'
import { Sheet } from '../ui/overlay'
import { bedLabel } from '../ui/strings'
import { ProGate, usePaywall } from './Pro'

// What Pro adds, behind the lock: made-up numbers, never the player's.
const SAMPLE: StringingReport = {
  sessions: 9,
  hours: 13.5,
  avg: { overall: 4.1, power: 3.9, control: 4.2, spin: 3.8, comfort: 4 },
  armPainShare: 0,
  blocks: [
    { fromHours: 0, sessions: 3, score: 4.6 },
    { fromHours: 3, sessions: 2, score: 4.4 },
    { fromHours: 6, sessions: 2, score: 3.8 },
    { fromHours: 9, sessions: 2, score: 3.3 },
  ],
  deathHours: 6,
  armPainAtHours: [],
}
const SAMPLE_NEXT: NextStringing = {
  tensionKg: 22,
  why: 'best',
  armPainShare: 0,
  changeAtHours: 7,
}

/** The one real number, free: how long the strings lasted, or have so far. */
const headlineOf = (st: Stringing, all: Stringing[], report: StringingReport, t: Dict, lang: string) =>
  report.deathHours !== undefined
    ? fmt(t.journal.lasted, { h: fmtNum(report.deathHours, 0, lang) })
    : isFinished(st, all)
      ? fmt(t.journal.replacedAfter, { h: fmtNum(report.hours, 1, lang) })
      : fmt(t.journal.goingOn, { h: fmtNum(report.hours, 1, lang) })

/**
 * The paywall's journal: the real number from the player's strings, and
 * what Pro adds to it, blurred (made-up numbers, as behind the lock).
 */
export function ReportTeaser({ value, stringings, sessions }: { value: Stringing; stringings: Stringing[]; sessions: Session[] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <div className="space-y-3 rounded-lg bg-surface-2 p-4">
      <p className="font-semibold" data-testid="teaser-number">
        {headlineOf(value, stringings, stringingReport(value, sessions), t, lang)}
      </p>
      <div aria-hidden inert className="pointer-events-none max-h-36 overflow-hidden blur-sm select-none">
        <ReportDetails report={SAMPLE} next={SAMPLE_NEXT} />
      </div>
    </div>
  )
}

/**
 * How a stringing's life went. Free: its hours, sessions and how long it
 * lasted. Pro: the averages, the curve, where it went dead, arm pain, and
 * what to string next.
 */
export function StringingReportSheet({ value, stringings, sessions, owned, onClose }: { value: Stringing; stringings: Stringing[]; sessions: Session[]; owned: OwnedRacket[]; onClose: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const report = stringingReport(value, sessions)
  const name = owned.find((o) => o.id === value.ownedId)?.name ?? value.label
  const headline = headlineOf(value, stringings, report, t, lang)
  return (
    <Sheet open onClose={onClose} title={t.journal.report}>
      <div className="space-y-5">
        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="font-semibold">{name}</p>
          <p className="num text-sm text-muted">
            {bedLabel(value.bed, t, lang)} · {fmtDate(value.date, lang)}
          </p>
        </div>
        <dl className="num grid grid-cols-2 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted">{t.journal.totalHours}</dt>
            <dd className="readout text-xl">{fmtNum(report.hours, 1, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t.journal.recent}</dt>
            <dd className="readout text-xl">{report.sessions}</dd>
          </div>
        </dl>
        <p className="text-lg font-semibold" data-testid="report-headline">
          {headline}
        </p>
        <ProGate title={t.journal.reportPro} reason="journal" preview={<ReportDetails report={SAMPLE} next={SAMPLE_NEXT} />}>
          <ReportDetails report={report} next={nextStringing(value, stringings, sessions)} />
        </ProGate>
      </div>
    </Sheet>
  )
}

/**
 * A restring reminder, opened from its notification: the racket, its
 * strings and how long they have played, then the new stringing. With Pro,
 * the strings' report; otherwise what Pro says about them, blurred (made-up
 * numbers), and the plans.
 */
export function RestringReminderSheet({
  value,
  stringings,
  sessions,
  owned,
  onRestring,
  onRetire,
  onReport,
  onClose,
}: {
  value: Stringing
  stringings: Stringing[]
  sessions: Session[]
  owned: OwnedRacket[]
  onRestring?: () => void
  /** Puts the racket away: a reminder for one no longer played. */
  onRetire?: () => void
  onReport: () => void
  onClose: () => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const name = owned.find((o) => o.id === value.ownedId)?.name ?? value.label
  return (
    <Sheet open onClose={onClose} title={t.journal.notifyTitle}>
      <div className="space-y-4">
        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="font-semibold">{name}</p>
          <p className="num text-sm text-muted">
            {bedLabel(value.bed, t, lang)} · {fmtDate(value.date, lang)}
          </p>
        </div>
        <p className="text-lg font-semibold" data-testid="reminder-headline">
          {timeHeadline(value, stringings, sessions, t) ?? headlineOf(value, stringings, stringingReport(value, sessions), t, lang)}
        </p>
        {onRestring && (
          <Button variant={pro ? 'primary' : 'secondary'} icon={RotateCw} className="w-full" onClick={onRestring}>
            {t.journal.addStringing}
          </Button>
        )}
        {pro ? (
          <Button className="w-full" onClick={onReport}>
            {t.journal.reminderReport}
          </Button>
        ) : (
          <div data-testid="reminder-pro" className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
            <p className="font-semibold">{t.journal.reminderPro}</p>
            <div aria-hidden inert className="pointer-events-none max-h-28 overflow-hidden blur-sm select-none">
              <ReportDetails report={SAMPLE} next={SAMPLE_NEXT} />
            </div>
            <Button variant="primary" icon={Sparkles} className="w-full" onClick={() => (onClose(), paywall('journal', { asked: true }))}>
              {t.paywall.seePro}
            </Button>
          </div>
        )}
        {onRetire && (
          <Button variant="ghost" icon={Archive} className="w-full" onClick={onRetire}>
            {t.journal.retire}
          </Button>
        )}
      </div>
    </Sheet>
  )
}

/** Strings out of time rather than hours: why, in the player's words. */
function timeHeadline(st: Stringing, all: Stringing[], sessions: Session[], t: Dict): string | undefined {
  if (isFinished(st, all)) return
  const life = lifeOf(st, sessions, Date.now(), all)
  if (life.used < 1 || life.limit !== 'time') return
  const when = life.days >= 60 ? fmt(t.journal.monthsN, { n: Math.floor(life.days / 30) }) : fmt(t.journal.weeksN, { n: Math.floor(life.days / 7) })
  return fmt(t.journal.dueByTime, { when })
}

function ReportDetails({ report, next }: { report: StringingReport; next: NextStringing }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const rated = SESSION_RATINGS.filter((k) => report.avg[k] !== undefined)
  return (
    <div className="space-y-5">
      <div data-testid="report-next" className="rounded-md border border-accent/40 bg-accent/5 p-3">
        <p className="num font-semibold">
          {fmt(t.journal.next, {
            kg: fmtNum(next.tensionKg, 0, lang),
            h: fmtNum(next.changeAtHours, 0, lang),
          })}
        </p>
        <p className="mt-1 text-sm text-muted">
          {fmt(t.journal.nextWhy[next.why], {
            n: Math.round(next.armPainShare * 100),
          })}
        </p>
      </div>

      {rated.length > 0 && (
        <section aria-label={t.journal.averages}>
          <h3 className="mb-2 text-sm font-semibold">{t.journal.averages}</h3>
          <dl className="num grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
            {rated.map((k) => (
              <div key={k} className="rounded-md bg-surface-2 px-2 py-1.5">
                <dt className="text-xs text-muted">{t.journal.ratings[k]}</dt>
                <dd className="readout">{fmtNum(report.avg[k], 1, lang)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {report.blocks.length > 0 && (
        <section aria-label={t.journal.curve}>
          <h3 className="mb-2 text-sm font-semibold">{t.journal.curve}</h3>
          <ul className="flex h-24 items-end gap-1.5">
            {report.blocks.map((b) => {
              const dead = report.deathHours !== undefined && b.fromHours >= report.deathHours
              const score = b.score === undefined ? t.journal.unrated : fmtNum(b.score, 1, lang)
              return (
                <li
                  key={b.fromHours}
                  className="flex h-full flex-1 flex-col justify-end"
                  aria-label={fmt(t.journal.curveBlock, {
                    from: b.fromHours,
                    to: b.fromHours + REPORT_BLOCK_HOURS,
                    score,
                  })}
                >
                  <span
                    aria-hidden
                    className="block rounded-sm"
                    style={{
                      height: b.score === undefined ? 3 : `${Math.max(8, (b.score / 5) * 100)}%`,
                      background: b.score === undefined ? 'var(--c-border)' : dead ? 'var(--c-warning)' : 'var(--c-area-journal)',
                    }}
                  />
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 flex justify-between text-[11px] text-muted" aria-hidden>
            <span>0 h</span>
            <span>{report.blocks.length * REPORT_BLOCK_HOURS} h</span>
          </p>
          <p className="mt-2 text-sm">{report.deathHours !== undefined ? fmt(t.journal.deadAt, { h: report.deathHours }) : t.journal.notDead}</p>
        </section>
      )}

      {report.armPainAtHours.length > 0 && (
        <p className="num text-sm text-danger">
          {fmt(t.journal.armPainAt, {
            list: report.armPainAtHours.map((h) => fmtNum(h, 0, lang)).join(', '),
          })}
        </p>
      )}
    </div>
  )
}
