import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Racket, RacketType } from '../domain/types'
import { deleteRacket, racketSchema, saveRacket, uid } from '../data/db'
import { useCustomRackets } from '../data/hooks'
import { useT } from '../i18n'
import { Button, Card, NumberField, PageTitle, Select, TextField } from '../ui/basics'
import { useToast } from '../ui/overlay'

type Draft = {
  brand: string
  model: string
  year?: number
  type: RacketType
  headSizeSqIn?: number
  lengthCm?: number
  weightG?: number
  balanceMm?: number
  swingweight?: number
  twistweight?: number
  ra?: number
}

export function RacketForm() {
  const { id } = useParams()
  const custom = useCustomRackets()
  const existing = id ? custom?.find((r) => r.id === id) : undefined
  if (id && custom === undefined) return null
  return <RacketFormInner key={existing?.id ?? 'new'} existing={existing} />
}

function RacketFormInner({ existing }: { existing?: Racket }) {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const [d, setD] = useState<Draft>(() =>
    existing
      ? { ...existing, balanceMm: existing.balanceCm * 10 }
      : { brand: '', model: '', type: 'tweener', headSizeSqIn: 100, lengthCm: 68.58 },
  )
  const [tried, setTried] = useState(false)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  const build = (): Racket | null => {
    const now = Date.now()
    const candidate = {
      id: existing?.id ?? uid(),
      brand: d.brand.trim(),
      model: d.model.trim(),
      year: d.year,
      type: d.type,
      isStock: false,
      lengthCm: d.lengthCm ?? 68.58,
      headSizeSqIn: d.headSizeSqIn,
      weightG: d.weightG,
      balanceCm: d.balanceMm === undefined ? undefined : d.balanceMm / 10,
      swingweight: d.swingweight,
      twistweight: d.twistweight,
      ra: d.ra,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const r = racketSchema.safeParse(candidate)
    return r.success ? (r.data as Racket) : null
  }

  const submit = async () => {
    setTried(true)
    const r = build()
    if (!r) return
    await saveRacket(r)
    toast(t.common.saved)
    nav('/rackets')
  }

  return (
    <>
      <PageTitle>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => nav(-1)} aria-label={t.common.back} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {existing ? t.racketForm.editTitle : t.racketForm.newTitle}
        </span>
      </PageTitle>
      <form
        className="mx-auto max-w-[560px] space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
      >
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t.racketForm.brand} value={d.brand} onChange={(brand) => set({ brand })} error={tried && !d.brand.trim() ? t.errors.required : undefined} maxLength={40} />
            <TextField label={t.racketForm.model} value={d.model} onChange={(model) => set({ model })} error={tried && !d.model.trim() ? t.errors.required : undefined} maxLength={60} />
            <NumberField label={t.racketForm.year} hint={t.common.optional} value={d.year} min={1970} max={2100} onChange={(year) => set({ year })} />
            <Select
              label={t.library.type}
              value={d.type}
              onChange={(type) => set({ type })}
              options={(['power', 'tweener', 'control', 'junior'] as const).map((v) => ({ value: v, label: t.library.types[v] }))}
            />
          </div>
        </Card>
        <Card className="space-y-4">
          <p className="text-sm text-muted">{t.racketForm.hint}</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={t.spec.weight} unit="g" required forceError={tried} min={150} max={450} value={d.weightG} onChange={(weightG) => set({ weightG })} />
            <NumberField label={t.spec.balance} unit="mm" required forceError={tried} min={250} max={400} value={d.balanceMm} onChange={(balanceMm) => set({ balanceMm })} />
            <NumberField label={t.spec.swingweight} required forceError={tried} min={150} max={450} value={d.swingweight} onChange={(swingweight) => set({ swingweight })} />
            <NumberField label={t.spec.twistweight} hint={t.common.optional} min={5} max={25} value={d.twistweight} onChange={(twistweight) => set({ twistweight })} />
            <NumberField label={t.spec.headSize} unit="in²" required forceError={tried} min={85} max={120} value={d.headSizeSqIn} onChange={(headSizeSqIn) => set({ headSizeSqIn })} />
            <NumberField label={t.spec.length} unit="cm" required forceError={tried} min={60} max={74} value={d.lengthCm} onChange={(lengthCm) => set({ lengthCm })} />
            <NumberField label={t.spec.ra} hint={t.common.optional} min={40} max={80} value={d.ra} onChange={(ra) => set({ ra })} />
          </div>
        </Card>
        {tried && !build() && (
          <p role="alert" className="text-sm text-danger">
            {t.racketForm.invalid}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {existing ? (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (!confirm(t.racketForm.deleteConfirm)) return
                await deleteRacket(existing.id)
                toast(t.common.deleted)
                nav('/rackets')
              }}
            >
              {t.common.delete}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="primary" icon={Save}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </>
  )
}
