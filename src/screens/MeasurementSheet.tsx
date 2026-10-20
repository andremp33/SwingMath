import { Save } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, saveOwned, uid } from '../data/db'
import { useStore } from '../data/store'
import { addMeasurement } from '../domain/fleet'
import { MEASURE_ORIGINS, type Measurement, type OwnedRacket } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { specLine } from '../lib/specLine'
import { Button, ChoiceChips, NumberField, Toggle } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { DateField } from './JournalSheets'

/**
 * A measurement saved to one of the player's rackets: from the pendulum
 * (the numbers come with it; only the racket and the strings are asked) or
 * typed in, a shop's or the player's own (on that racket's sheet).
 */
export function MeasurementSheet({
  owned,
  ownedId,
  value,
  fromPendulum,
  onClose,
}: {
  /** The rackets to choose from. */
  owned: OwnedRacket[]
  /** The racket it is for, when already known. */
  ownedId?: string
  value: Partial<Measurement>
  fromPendulum?: boolean
  onClose: () => void
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const [racket, setRacket] = useState(ownedId ?? owned[0]?.id)
  const [m, setM] = useState<Partial<Measurement>>(() => ({ date: Date.now(), strung: true, origin: fromPendulum ? 'pendulum' : 'shop', ...value }))
  const [error, setError] = useState<string>()
  const set = (p: Partial<Measurement>) => setM({ ...m, ...p })
  const target = owned.find((o) => o.id === racket)

  const save = async () => {
    if (!target) return
    if (m.weightG === undefined || m.balanceCm === undefined || m.swingweight === undefined) return setError(t.racketForm.invalid)
    // The racket as it is now: another sheet may have changed it.
    const o = (await db.owned.get(target.id)) ?? target
    const entry: Measurement = { id: uid(), date: m.date!, weightG: m.weightG, balanceCm: m.balanceCm, swingweight: m.swingweight, twistweight: m.twistweight, strung: !!m.strung, origin: m.origin! }
    await saveOwned({ ...o, measurements: addMeasurement(o.measurements, entry), updatedAt: Date.now() })
    toast(fmt(t.measurements.saved, { name: o.name }))
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={fromPendulum ? t.measurements.saveTitle : t.measurements.addTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save} disabled={!target}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!ownedId &&
          (owned.length === 0 ? (
            <p className="text-sm">
              {t.measurements.noRackets}{' '}
              <Link to="/diario" className="font-semibold text-accent-text">
                {t.measurements.addInJournal}
              </Link>
            </p>
          ) : (
            <ChoiceChips label={t.measurements.which} value={racket} onChange={setRacket} options={owned.map((o) => ({ value: o.id, label: o.name }))} />
          ))}
        {fromPendulum ? (
          <p className="num rounded-md bg-surface-2 px-3 py-2.5 font-semibold">{specLine(m as Measurement, t, lang)}</p>
        ) : (
          <>
            <DateField label={t.journal.date} value={m.date!} onChange={(date) => set({ date })} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t.spec.weight} unit="g" min={150} max={500} required value={m.weightG} onChange={(weightG) => set({ weightG })} />
              <NumberField
                label={t.spec.balance}
                unit="mm"
                min={250}
                max={400}
                required
                value={m.balanceCm === undefined ? undefined : Math.round(m.balanceCm * 100) / 10}
                onChange={(mm) => set({ balanceCm: mm === undefined ? undefined : mm / 10 })}
              />
              <NumberField label={t.spec.swingweight} min={150} max={450} required value={m.swingweight} onChange={(swingweight) => set({ swingweight })} />
              <NumberField label={t.spec.twistweight} hint={t.common.optional} min={5} max={25} value={m.twistweight} onChange={(twistweight) => set({ twistweight })} />
            </div>
            <ChoiceChips
              label={t.measurements.origin}
              value={m.origin}
              onChange={(origin) => set({ origin })}
              options={MEASURE_ORIGINS.filter((k) => k !== 'pendulum').map((k) => ({ value: k, label: t.measurements.origins[k] }))}
            />
          </>
        )}
        <Toggle label={t.measurements.strung} checked={!!m.strung} onChange={(strung) => set({ strung })} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
