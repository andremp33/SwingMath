import { ChevronDown, FileText, Pencil, Plus, RotateCw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { db, deleteStringing, saveOwned, saveSession, saveStringing, uid } from '../data/db'
import { useRacket, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import {
  currentStringings,
  hoursOn,
  insights,
  latestOf,
  lifeOf,
  SESSION_KINDS,
  SESSION_RATINGS,
  type OwnedRacket,
  type Session,
  type Stringing,
} from '../domain/journal'
import { needsRemeasure } from '../domain/fleet'
import { DEFAULT_STRINGBED, type Stringbed } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum, racketLabel } from '../lib/format'
import { specLine } from '../lib/specLine'
import { Button, ChoiceChips, cx, Label, NumberField, RatingInput, Select, TextField, Toggle } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { RacketPicker } from '../ui/RacketPicker'
import { bedLabel, StringbedEditor } from '../ui/strings'
import { useUnits } from '../lib/units'
import { useAfterSession } from './Community'
import { useDeleteOwned } from './deleteOwned'

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day for <input type="date">. */
export const toDateInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Noon on that local day, so time zones never move it to another day. */
export const fromDateInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}
const sameDay = (a: number, b: number) => toDateInput(a) === toDateInput(b)

const inputClass = 'h-11 w-full rounded-md border border-border-input bg-field px-3'

export function DateField({ label, value, onChange }: { label: string; value: number; onChange: (ms: number) => void }) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="date"
        className={cx(inputClass, 'num')}
        value={toDateInput(value)}
        max={toDateInput(Date.now())}
        onChange={(e) => e.target.value && onChange(fromDateInput(e.target.value))}
      />
    </div>
  )
}

function Notes({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const t = useT()
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>{t.journal.notes}</Label>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-input bg-field px-3 py-2"
      />
    </div>
  )
}

/** Today, yesterday or another day, the last opening a date field. */
function WhenField({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const t = useT()
  // Today as the field opened.
  const [now] = useState(Date.now)
  const preset = sameDay(value, now) ? 'today' : sameDay(value, now - DAY) ? 'yesterday' : 'other'
  const [other, setOther] = useState(preset === 'other')
  return (
    <div className="space-y-3">
      <ChoiceChips
        label={t.journal.when}
        value={other ? 'other' : preset}
        onChange={(v) => {
          setOther(v === 'other')
          if (v === 'today') onChange(fromDateInput(toDateInput(now)))
          if (v === 'yesterday') onChange(fromDateInput(toDateInput(now - DAY)))
        }}
        options={[
          { value: 'today', label: t.journal.today },
          { value: 'yesterday', label: t.journal.yesterday },
          { value: 'other', label: t.journal.otherDay },
        ]}
      />
      {other && <DateField label={t.journal.date} value={value} onChange={onChange} />}
    </div>
  )
}

const DURATIONS = [30, 45, 60, 90, 120] as const


/**
 * A racket the player owns: new (with the strings it has now, so the journal
 * can start counting) or edited.
 */
export function OwnedSheet({ value, onClose, initialBed }: { value: OwnedRacket | null; onClose: () => void; initialBed?: Stringbed }) {
  const t = useT()
  const toast = useToast()
  const remove = useDeleteOwned()
  const setups = useSetups()
  const config = useStore((s) => s.config)
  const [draft, setDraft] = useState<OwnedRacket | null>(value)
  const [bed, setBed] = useState<Stringbed>(initialBed ?? config.strings ?? DEFAULT_STRINGBED)
  const [strungOn, setStrungOn] = useState(() => Date.now())
  const [error, setError] = useState<string>()
  const isNew = value !== null && value.createdAt === value.updatedAt
  useEffect(() => {
    setDraft(value)
    setError(undefined)
    setBed(initialBed ?? config.strings ?? DEFAULT_STRINGBED)
    setStrungOn(Date.now())
    // Reset only when another racket opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const racket = useRacket(draft?.racketId)
  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const set = (p: Partial<OwnedRacket>) => setDraft({ ...draft, ...p })
  const save = async () => {
    const name = draft.name.trim()
    if (!name) return setError(t.journal.racketNameHint)
    const clash = await db.owned.filter((o) => o.id !== draft.id && o.name.trim().toLowerCase() === name.toLowerCase()).count()
    if (clash) return setError(t.journal.racketNameTaken)
    const now = Date.now()
    // The strings first: saving the racket changes the page behind this
    // sheet (the first racket ends the journal's welcome), so it goes last.
    if (isNew)
      await saveStringing({ id: uid(), ownedId: draft.id, label: name, racketId: draft.racketId, setupId: draft.setupId, date: strungOn, bed, createdAt: now, updatedAt: now })
    await saveOwned({ ...draft, name, notes: draft.notes?.trim() || undefined, updatedAt: now + (isNew ? 1 : 0) })
    toast(t.journal.racketSaved)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? t.journal.addRacket : t.journal.editRacket}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              icon={Trash2}
              className="mr-auto"
              onClick={async () => {
                await remove(draft)
                onClose()
              }}
            >
              {t.common.delete}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField
          label={t.journal.racketName}
          hint={t.journal.racketNameHint}
          value={draft.name}
          onChange={(name) => set({ name })}
          placeholder={t.journal.racketNamePlaceholder}
          error={error}
          maxLength={40}
          autoFocus={isNew}
        />
        <RacketPicker label={t.journal.frame} value={racket} onChange={(r) => set({ racketId: r.id })} />
        {setups && setups.length > 0 && (
          <Select
            label={t.journal.setup}
            value={draft.setupId ?? ''}
            onChange={(id) => {
              const s = setups.find((x) => x.id === id)
              set({ setupId: id || undefined, ...(s ? { racketId: s.racketId } : {}) })
              if (s?.strings && isNew) setBed(structuredClone(s.strings))
            }}
            options={[{ value: '', label: t.journal.noSetup }, ...setups.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
        {isNew && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">{t.journal.stringsNow}</p>
              <StringbedEditor value={bed} onChange={setBed} />
            </div>
            <DateField label={t.journal.strungOn} value={strungOn} onChange={setStrungOn} />
          </>
        )}
        <Notes value={draft.notes} onChange={(notes) => set({ notes })} />
        {!isNew && <Toggle label={t.journal.retire} hint={t.journal.retireHint} checked={!!draft.retired} onChange={(retired) => set({ retired })} />}
      </div>
    </Sheet>
  )
}

/** A stringing of one owned racket: a restring (prefilled from the last) or an edit. */
export function StringingSheet({
  value,
  owned,
  onClose,
  onRestrung,
}: {
  value: Stringing | null
  owned: OwnedRacket[]
  onClose: () => void
  /** After a new stringing (not an edit) is saved. */
  onRestrung?: (st: Stringing) => void
}) {
  const t = useT()
  const toast = useToast()
  const [draft, setDraft] = useState<Stringing | null>(value)
  // A new stringing to edit starts a new draft.
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  const o = owned.find((x) => x.id === draft?.ownedId)
  const racket = useRacket(o?.racketId ?? draft?.racketId)
  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  // New ones are created with updatedAt = createdAt; saving moves updatedAt on.
  const isEdit = value !== null && value.updatedAt !== value.createdAt
  const set = (p: Partial<Stringing>) => setDraft({ ...draft, ...p })
  const save = async () => {
    const saved = {
      ...draft,
      label: o?.name ?? draft.label,
      racketId: o?.racketId ?? draft.racketId,
      notes: draft.notes?.trim() || undefined,
      updatedAt: Date.now() + (isEdit ? 0 : 1),
    }
    await saveStringing(saved)
    toast(t.journal.saved)
    onClose()
    if (!isEdit) onRestrung?.(saved)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t.journal.stringing}
      footer={
        <>
          {isEdit && (
            <Button
              variant="danger"
              icon={Trash2}
              className="mr-auto"
              onClick={async () => {
                await deleteStringing(draft.id)
                toast(t.common.deleted)
                onClose()
              }}
            >
              {t.common.delete}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-md bg-surface-2 px-3 py-2.5">
          <p className="font-semibold">{o?.name ?? draft.label}</p>
          {racket && <p className="truncate text-sm text-muted">{racketLabel(racket)}</p>}
        </div>
        <DateField label={t.journal.strungOn} value={draft.date} onChange={(date) => set({ date })} />
        <StringbedEditor value={draft.bed} onChange={(bed) => set({ bed })} />
        <NumberField label={t.journal.lifeHours} hint={t.journal.lifeHoursHint} unit="h" min={2} max={200} value={draft.lifeHours} onChange={(lifeHours) => set({ lifeHours })} />
        <Notes value={draft.notes} onChange={(notes) => set({ notes })} />
      </div>
    </Sheet>
  )
}

/**
 * Log a session in a few taps: racket, when, how long, what kind, how it
 * went. Everything else waits under "More details".
 */
export function SessionSheet({ value, stringings, owned, onClose }: { value: Session | null; stringings: Stringing[]; owned: OwnedRacket[]; onClose: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const [draft, setDraft] = useState<Session | null>(value)
  const afterSession = useAfterSession()
  const [more, setMore] = useState(false)
  const [otherLength, setOtherLength] = useState(false)
  // A new session to edit starts a new draft, with "More details" open if it has any.
  const [shown, setShown] = useState<Session | null>(null)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
    const r = value?.ratings ?? {}
    setMore(!!(value && (r.power || r.control || r.spin || r.comfort || value.armPain || value.notes)))
    setOtherLength(!!value && !DURATIONS.includes(value.minutes as (typeof DURATIONS)[number]))
  }
  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const isEdit = value !== null && value.updatedAt !== value.createdAt
  const set = (p: Partial<Session>) => setDraft({ ...draft, ...p })
  const save = async () => {
    const saved = { ...draft, notes: draft.notes?.trim() || undefined, updatedAt: Date.now() + (isEdit ? 0 : 1) }
    await saveSession(saved)
    toast(t.journal.sessionSaved)
    onClose()
    // A play for the recipe it came from; maybe an invitation to publish it.
    if (!isEdit) void afterSession(saved, owned, stringings)
  }

  // Each active racket by its current stringing, plus the older stringing an
  // edited session points at.
  const current = owned
    .filter((o) => !o.retired)
    .map((o) => ({ o, s: latestOf(o.id, stringings) }))
    .filter((x): x is { o: OwnedRacket; s: Stringing } => !!x.s)
  const older = stringings.find((s) => s.id === draft.stringingId && !current.some((c) => c.s.id === s.id))
  const chips = [
    ...current.map((c) => ({ value: c.s.id, label: c.o.name })),
    ...(older ? [{ value: older.id, label: `${owned.find((o) => o.id === older.ownedId)?.name ?? older.label} (${fmtDate(older.date, lang)})` }] : []),
    { value: 'none', label: t.journal.noRacketChip },
  ]

  return (
    <Sheet
      open
      onClose={onClose}
      title={t.journal.sessionTitle}
      footer={
        <>
          {isEdit && (
            <Button
              variant="danger"
              icon={Trash2}
              className="mr-auto"
              onClick={async () => {
                await db.sessions.delete(draft.id)
                toast(t.common.deleted, { label: t.common.undo, run: () => void db.sessions.put(draft) })
                onClose()
              }}
            >
              {t.common.delete}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ChoiceChips label={t.journal.racket} value={draft.stringingId ?? 'none'} onChange={(id) => set({ stringingId: id === 'none' ? undefined : id })} options={chips} />
        <WhenField value={draft.date} onChange={(date) => set({ date })} />
        <div className="space-y-3">
          <ChoiceChips
            label={t.journal.minutes}
            value={otherLength ? 'other' : String(draft.minutes)}
            onChange={(v) => {
              setOtherLength(v === 'other')
              if (v !== 'other') set({ minutes: Number(v) })
            }}
            options={[...DURATIONS.map((m) => ({ value: String(m), label: fmt(t.journal.minutesShort, { n: m }) })), { value: 'other', label: t.journal.otherLength }]}
          />
          {otherLength && <NumberField label={t.journal.minutes} unit="min" min={5} max={600} value={draft.minutes} onChange={(v) => v !== undefined && set({ minutes: Math.round(v) })} />}
        </div>
        <ChoiceChips label={t.journal.kind} value={draft.kind} onChange={(kind) => set({ kind })} options={SESSION_KINDS.map((k) => ({ value: k, label: t.journal.kinds[k] }))} />
        <RatingInput label={t.journal.howWasIt} value={draft.ratings.overall} onChange={(v) => set({ ratings: { ...draft.ratings, overall: v } })} ends={t.journal.ratingEnds} />

        <div className="border-t border-border pt-3">
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex w-full items-center justify-between py-1 text-sm font-semibold">
            {t.journal.moreDetails}
            <ChevronDown className={cx('size-4 text-muted transition-transform', more && 'rotate-180')} aria-hidden />
          </button>
          {more && (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                {SESSION_RATINGS.filter((k) => k !== 'overall').map((k) => (
                  <RatingInput key={k} label={t.journal.ratings[k]} value={draft.ratings[k]} onChange={(v) => set({ ratings: { ...draft.ratings, [k]: v } })} />
                ))}
              </div>
              <Toggle label={t.journal.armPain} checked={!!draft.armPain} onChange={(armPain) => set({ armPain })} />
              <Notes value={draft.notes} onChange={(notes) => set({ notes })} />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/** One racket's story: its strings now, totals, every stringing and its sessions. */
export function RacketSheet({
  value,
  stringings,
  sessions,
  onClose,
  onEdit,
  onRestring,
  onEditStringing,
  onEditSession,
  onReport,
  onMeasure,
}: {
  value: OwnedRacket | null
  stringings: Stringing[]
  sessions: Session[]
  onClose: () => void
  onEdit: (o: OwnedRacket) => void
  onRestring: (o: OwnedRacket) => void
  onEditStringing: (s: Stringing) => void
  onEditSession: (s: Session) => void
  onReport: (s: Stringing) => void
  onMeasure: (o: OwnedRacket) => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const racket = useRacket(value?.racketId)
  const [now] = useState(() => Date.now())
  const mine = useMemo(() => (value ? currentStringings(stringings.filter((s) => s.ownedId === value.id)) : []), [value, stringings])
  const history = useMemo(() => (value ? stringings.filter((s) => s.ownedId === value.id).sort((a, b) => b.date - a.date) : []), [value, stringings])
  if (!value) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const ids = new Set(history.map((s) => s.id))
  const played = sessions.filter((s) => s.stringingId && ids.has(s.stringingId))
  const hours = played.reduce((h, s) => h + s.minutes / 60, 0)
  const rated = played.map((s) => s.ratings.overall).filter((v): v is number => v !== undefined)
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : undefined
  const perStringing = new Map(insights(history, sessions).map((i) => [i.stringing.id, i]))
  const now0 = mine[0] ? lifeOf(mine[0], sessions, now, stringings) : undefined

  return (
    <Sheet
      open
      onClose={onClose}
      title={value.name}
      footer={
        <>
          <Button icon={Pencil} className="mr-auto" onClick={() => onEdit(value)}>
            {t.journal.editRacket}
          </Button>
          <Button variant="primary" icon={RotateCw} onClick={() => onRestring(value)}>
            {t.journal.addStringing}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {racket && <p className="-mt-2 text-sm text-muted">{racketLabel(racket)}</p>}
        <dl className="num grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-3 text-center">
          <div>
            <dt className="text-xs text-muted">{t.journal.totalHours}</dt>
            <dd className="readout text-lg">{fmtNum(hours, 1, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t.journal.recent}</dt>
            <dd className="readout text-lg">{played.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t.journal.avgRating}</dt>
            <dd className="readout text-lg">{avg === undefined ? '—' : fmtNum(avg, 1, lang)}</dd>
          </div>
        </dl>
        {now0 && mine[0] && <LifeBar life={now0} />}

        <Measurements owned={value} latest={mine[0]} onAdd={() => onMeasure(value)} />

        <section aria-label={t.journal.stringings}>
          <h3 className="mb-2 text-sm font-semibold">{t.journal.stringings}</h3>
          <ul className="divide-y divide-border">
            {history.map((s) => {
              const i = perStringing.get(s.id)
              const h = hoursOn(s.id, sessions)
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => onEditStringing(s)} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 text-left text-sm">
                    <span className="min-w-0">
                      <span className="num block font-medium">{bedLabel(s.bed, t, lang)}</span>
                      <span className="num block text-muted">
                        {fmtDate(s.date, lang)} · {fmt(t.journal.hours, { h: fmtNum(h, 1, lang) })}
                      </span>
                    </span>
                    {i?.avg.overall !== undefined && <span className="readout shrink-0">{fmtNum(i.avg.overall, 1, lang)}</span>}
                  </button>
                  {h > 0 && (
                    <Button size="sm" variant="ghost" icon={FileText} aria-label={fmt(t.journal.reportOf, { date: fmtDate(s.date, lang) })} onClick={() => onReport(s)}>
                      {t.journal.reportOpen}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {played.length > 0 && (
          <section aria-label={t.journal.recent}>
            <h3 className="mb-2 text-sm font-semibold">{t.journal.recent}</h3>
            <SessionList sessions={played.slice(0, 10)} stringings={stringings} owned={[value]} onOpen={onEditSession} />
          </section>
        )}
      </div>
    </Sheet>
  )
}

export type Life = ReturnType<typeof lifeOf>

/** Strings left, as a bar in the colour of how urgent a restring is. */
export function LifeBar({ life, compact }: { life: Life; compact?: boolean }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const left = Math.max(0, 1 - life.used)
  const pct = Math.round(left * 100)
  const tone = life.used >= 1 ? 'var(--c-danger)' : left < 0.25 ? 'var(--c-warning)' : 'var(--c-success)'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cx('readout', compact ? 'text-lg' : 'text-xl')}>
          {life.used >= 1 ? t.journal.restringNow : fmt(t.journal.hoursLeft, { h: fmtNum(life.hoursLeft, 0, lang) })}
        </span>
        <span className="num text-xs text-muted">{fmt(t.journal.lifeLeft, { n: pct })}</span>
      </div>
      <div
        role="meter"
        aria-label={t.journal.life}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(3, pct)}%`, background: tone }} />
      </div>
    </div>
  )
}

const KIND_COLOR: Record<Session['kind'], string> = {
  practice: 'var(--c-comfort)',
  match: 'var(--c-power)',
  lesson: 'var(--c-stability)',
  serve: 'var(--c-plow)',
}

/** Sessions as rows: what, how long, with which racket, how it went. A tap opens it. */
export function SessionList({ sessions, stringings, owned, onOpen }: { sessions: Session[]; stringings: Stringing[]; owned: OwnedRacket[]; onOpen: (s: Session) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const byId = new Map(stringings.map((s) => [s.id, s]))
  const nameOf = (s: Session) => {
    const st = s.stringingId ? byId.get(s.stringingId) : undefined
    return st ? (owned.find((o) => o.id === st.ownedId)?.name ?? st.label) : undefined
  }
  return (
    <ul className="divide-y divide-border">
      {sessions.map((s) => {
        const name = nameOf(s)
        const r = s.ratings.overall
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(s)} className="flex w-full items-center gap-3 py-2.5 text-left" aria-label={`${t.journal.kinds[s.kind]}, ${fmt(t.journal.minutesShort, { n: s.minutes })}, ${fmtDate(s.date, lang)}${r ? `, ${r}/5` : ''}`}>
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[s.kind] }} />
              <span className="min-w-0 flex-1 text-sm">
                <span className="num block">
                  <span className="font-medium">{t.journal.kinds[s.kind]}</span> · {fmt(t.journal.minutesShort, { n: s.minutes })}
                  {s.armPain && <span className="text-danger"> · {t.journal.armPainShort}</span>}
                </span>
                <span className="block truncate text-muted">
                  {new Date(s.date).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'pt-PT', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                  {name && <> · {name}</>}
                </span>
              </span>
              <span aria-hidden className="flex shrink-0 gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cx('size-1.5 rounded-full', r !== undefined && i <= r ? 'bg-accent' : 'bg-border')} />
                ))}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** A racket's measurements, newest first, and the lead on it: free to see
 *  and to delete, like all the player's data. */
function Measurements({ owned, latest, onAdd }: { owned: OwnedRacket; latest?: Stringing; onAdd: () => void }) {
  const t = useT()
  const units = useUnits()
  const lang = useStore((s) => s.lang)
  const list = owned.measurements ?? []
  const lead = owned.lead && Object.values(owned.lead.leadG).reduce((a, b) => a + b, 0) + (owned.lead.extra ?? []).reduce((a, e) => a + e.grams, 0)
  const save = (p: Partial<OwnedRacket>) => saveOwned({ ...owned, ...p, updatedAt: Date.now() })
  return (
    <section aria-label={t.measurements.title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.measurements.title}</h3>
        <Button size="sm" variant="ghost" icon={Plus} onClick={onAdd}>
          {t.measurements.add}
        </Button>
      </div>
      {needsRemeasure(owned, latest) && <p className="mb-2 text-sm text-warning">{t.fleet.remeasure}</p>}
      {lead !== undefined && lead > 0 && (
        <p className="num mb-2 flex items-center justify-between gap-2 text-sm">
          {fmt(t.measurements.lead, { g: fmtNum(lead, 1, lang) })}
          <button type="button" onClick={() => save({ lead: undefined })} className="text-xs font-medium text-accent-text hover:underline">
            {t.measurements.removeLead}
          </button>
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted">{t.measurements.none}</p>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="num block font-medium">{specLine(m, t, lang, units)}</span>
                <span className="num block text-muted">
                  {fmtDate(m.date, lang)} · {t.measurements.origins[m.origin]} · {m.strung ? t.fleet.strung : t.fleet.unstrung}
                </span>
              </span>
              <button
                type="button"
                aria-label={fmt(t.measurements.delete, { date: fmtDate(m.date, lang) })}
                onClick={() => save({ measurements: list.filter((x) => x.id !== m.id) })}
                className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
