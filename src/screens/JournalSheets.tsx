import { Save, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { deleteStringing, saveSession, saveStringing } from '../data/db'
import { useRacket, useSetups } from '../data/hooks'
import { currentStringings, SESSION_KINDS, SESSION_RATINGS, type Session, type Stringing } from '../domain/journal'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { useT } from '../i18n'
import { Button, cx, Label, NumberField, RatingInput, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { RacketPicker } from '../ui/RacketPicker'
import { StringbedEditor } from '../ui/strings'

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

const inputClass = 'h-11 w-full rounded-md border border-border-input bg-bg px-3'

function DateField({ label, value, onChange }: { label: string; value: number; onChange: (ms: number) => void }) {
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
        className="w-full rounded-md border border-border-input bg-bg px-3 py-2"
      />
    </div>
  )
}

/** New stringing, restring (prefilled from the last one) or edit. */
export function StringingSheet({ value, onClose }: { value: Stringing | null; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const setups = useSetups()
  const [draft, setDraft] = useState<Stringing | null>(value)
  const [error, setError] = useState<string>()
  useEffect(() => {
    setDraft(value)
    setError(undefined)
  }, [value])
  const racket = useRacket(draft?.racketId)
  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  // New ones are created with updatedAt = createdAt; saving moves updatedAt on.
  const isEdit = value !== null && value.updatedAt !== value.createdAt
  const set = (p: Partial<Stringing>) => setDraft({ ...draft, ...p })
  const save = async () => {
    if (!draft.label.trim()) {
      setError(t.journal.labelHint)
      return
    }
    const now = Date.now()
    await saveStringing({ ...draft, label: draft.label.trim(), notes: draft.notes?.trim() || undefined, updatedAt: now })
    toast(t.journal.saved)
    onClose()
  }

  return (
    <Sheet
      open={value !== null}
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
        <TextField label={t.journal.label} value={draft.label} onChange={(label) => set({ label })} placeholder={t.journal.labelHint} error={error} maxLength={40} autoFocus={!draft.label} />
        <RacketPicker label={t.journal.frame} value={racket} onChange={(r) => set({ racketId: r.id })} />
        {setups && setups.length > 0 && (
          <Select
            label={t.journal.setup}
            value={draft.setupId ?? ''}
            onChange={(id) => {
              const s = setups.find((x) => x.id === id)
              set({ setupId: id || undefined, ...(s ? { racketId: s.racketId, bed: structuredClone(s.strings ?? draft.bed ?? DEFAULT_STRINGBED) } : {}) })
            }}
            options={[{ value: '', label: t.journal.noSetup }, ...setups.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
        <DateField label={t.journal.date} value={draft.date} onChange={(date) => set({ date })} />
        <StringbedEditor value={draft.bed} onChange={(bed) => set({ bed })} />
        <NumberField label={t.journal.lifeHours} hint={t.journal.lifeHoursHint} unit="h" min={2} max={200} value={draft.lifeHours} onChange={(lifeHours) => set({ lifeHours })} />
        <Notes value={draft.notes} onChange={(notes) => set({ notes })} />
      </div>
    </Sheet>
  )
}

export function SessionSheet({ value, stringings, onClose }: { value: Session | null; stringings: Stringing[]; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [draft, setDraft] = useState<Session | null>(value)
  useEffect(() => setDraft(value), [value])
  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const set = (p: Partial<Session>) => setDraft({ ...draft, ...p })
  const save = async () => {
    await saveSession({ ...draft, notes: draft.notes?.trim() || undefined, updatedAt: Date.now() })
    toast(t.journal.sessionSaved)
    onClose()
  }
  // Each racket's current stringing, plus the older one an edited session points at.
  const current = currentStringings(stringings)
  const older = stringings.find((s) => s.id === draft.stringingId && !current.includes(s))
  const options = older ? [...current, older] : current

  return (
    <Sheet
      open={value !== null}
      onClose={onClose}
      title={t.journal.sessionTitle}
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
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <DateField label={t.journal.date} value={draft.date} onChange={(date) => set({ date })} />
          <NumberField label={t.journal.minutes} unit="min" min={5} max={600} value={draft.minutes} onChange={(v) => v !== undefined && set({ minutes: Math.round(v) })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm">{t.journal.kind}</span>
          <Segmented label={t.journal.kind} value={draft.kind} onChange={(kind) => set({ kind })} options={SESSION_KINDS.map((k) => ({ value: k, label: t.journal.kinds[k] }))} />
        </div>
        <Select
          label={t.journal.racket}
          value={draft.stringingId ?? ''}
          onChange={(id) => set({ stringingId: id || undefined })}
          options={[{ value: '', label: t.journal.noRacket }, ...options.map((s) => ({ value: s.id, label: s === older ? `${s.label} (${toDateInput(s.date)})` : s.label }))]}
        />
        <div>
          <Label>{t.journal.howWasIt}</Label>
          <div className="space-y-2">
            {SESSION_RATINGS.map((k) => (
              <RatingInput key={k} label={t.journal.ratings[k]} value={draft.ratings[k]} onChange={(v) => set({ ratings: { ...draft.ratings, [k]: v } })} />
            ))}
          </div>
        </div>
        <Toggle label={t.journal.armPain} checked={!!draft.armPain} onChange={(armPain) => set({ armPain })} />
        <Notes value={draft.notes} onChange={(notes) => set({ notes })} />
      </div>
    </Sheet>
  )
}
