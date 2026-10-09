import { Flag, Send, Trash2, Upload, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { compute } from '../domain/physics'
import type { Racket, Setup } from '../domain/types'
import { fmt, useT } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import {
  countCopy,
  deletePublicSetup,
  measurementStats,
  publicSetups,
  publishSetup,
  reportSetup,
  submitMeasurement,
  type MeasurementStats,
  type PublicSetup,
} from '../lib/community'
import { fmtNum, leadParts } from '../lib/format'
import { Button, Card, CardTitle, IconButton, Segmented, TextField, Toggle } from '../ui/basics'
import { useToast } from '../ui/overlay'

/** Calculator card: what players measured, and setups they published. */
export function CommunityCard({ racket }: { racket: Racket }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const account = useStore((s) => s.account)
  const loadConfig = useStore((s) => s.loadConfig)
  const toast = useToast()
  const [stats, setStats] = useState<MeasurementStats[]>()
  const [setups, setSetups] = useState<PublicSetup[]>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    setStats(undefined)
    setSetups(undefined)
    measurementStats(racket.id).then((s) => alive && setStats(s))
    publicSetups(racket.id).then((s) => alive && setSetups(s))
    return () => {
      alive = false
    }
  }, [racket.id, version])

  if (!cloudConfigured() || !racket.isStock) return null

  const signedIn = (fn: () => Promise<void>) => async () => {
    if (!account) return toast(t.community.needAccount)
    try {
      await fn()
    } catch {
      toast(t.community.error)
    }
  }

  return (
    <Card label={t.community.title}>
      <CardTitle>{t.community.title}</CardTitle>
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
              <p className="mt-1 text-xs text-muted">{t.community.medianHint}</p>
            </div>
          ))
        )}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-medium">{t.community.setups}</h3>
      {setups === undefined ? null : setups.length === 0 ? (
        <p className="text-sm text-muted">{t.community.noSetups}</p>
      ) : (
        <ul className="divide-y divide-border">
          {setups.map((p) => {
            const mine = account?.userId === p.user_id
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">
                    {p.name} <span className="font-normal text-muted">· {p.author || t.community.anon}</span>
                  </p>
                  <p className="num text-muted">
                    {fmtNum(p.specs.weightG, 1, lang)} g · {fmtNum(p.specs.balanceCm * 10, 1, lang)} mm · SW {fmtNum(p.specs.swingweight, 1, lang)}
                  </p>
                  <p className="num text-muted">
                    {leadParts(p.config, t, lang).join(' · ') || t.setups.noLead} · {p.copies === 1 ? t.community.copyOne : fmt(t.community.copies, { n: p.copies })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      loadConfig({ ...p.config, racketId: racket.id }, null)
                      void countCopy(p.id)
                      toast(t.community.tried)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    {t.community.tryIt}
                  </Button>
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
                    <IconButton
                      icon={Flag}
                      label={`${t.community.report} ${p.name}`}
                      onClick={signedIn(async () => {
                        await reportSetup(p.id)
                        toast(t.community.reported)
                      })}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** In the share sheet: publish a saved setup for everyone. */
export function PublishSetup({ setup, racket }: { setup: Setup; racket: Racket }) {
  const t = useT()
  const toast = useToast()
  const account = useStore((s) => s.account)
  const masses = useStore((s) => s.masses)
  const [open, setOpen] = useState(false)
  const [author, setAuthor] = useState('')
  const [busy, setBusy] = useState(false)
  if (!cloudConfigured() || !racket.isStock) return null

  if (!open)
    return (
      <Button icon={Users} className="w-full" onClick={() => (account ? setOpen(true) : toast(t.community.needAccount))}>
        {t.community.publish}
      </Button>
    )
  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          const { result } = compute({ spec: racket, ...setup, masses })
          await publishSetup({
            name: setup.name,
            author,
            config: setup,
            racket,
            specs: result,
          })
          toast(t.community.published)
          setOpen(false)
        } catch {
          toast(t.community.error)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-muted">{t.community.publishHint}</p>
      <TextField label={`${t.community.author} (${t.community.authorHint})`} value={author} onChange={setAuthor} maxLength={30} />
      <Button type="submit" variant="primary" icon={Upload} loading={busy} className="w-full">
        {t.community.publish}
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
  if (!cloudConfigured() || !racket || weightG === undefined) return null

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
