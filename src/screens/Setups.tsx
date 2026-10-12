import { Calculator, ClipboardList, GitCompareArrows, Pencil, Plus, Printer, Share2, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OwnedRacket } from '../domain/journal'
import { STROKES, type Setup } from '../domain/types'
import { db, saveSetup, uid } from '../data/db'
import { useAllRackets, useOwned, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtDate, leadParts, racketLabel } from '../lib/format'
import { Button, cx, EmptyState, IconButton, PageTitle, Select } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { OwnedSheet } from './JournalSheets'
import { SetupEditSheet } from './SetupEdit'
import { ShareSheet } from './ShareSheet'

export function Setups() {
  const t = useT()
  const nav = useNavigate()
  const setups = useSetups()
  const rackets = useAllRackets()
  const compare = useStore((s) => s.compare)
  const clearCompare = useStore((s) => s.clearCompare)
  const [racketFilter, setRacketFilter] = useState('all')
  const [editing, setEditing] = useState<Setup | null>(null)
  const [sharing, setSharing] = useState<Setup | null>(null)

  const usedRackets = useMemo(() => {
    const ids = new Set(setups?.map((s) => s.racketId))
    return rackets.filter((r) => ids.has(r.id))
  }, [setups, rackets])

  const list = useMemo(
    () =>
      (setups ?? [])
        .filter((s) => racketFilter === 'all' || s.racketId === racketFilter)
        .sort((a, b) => Number(b.favourite) - Number(a.favourite) || b.updatedAt - a.updatedAt),
    [setups, racketFilter],
  )

  if (setups === undefined) return null

  return (
    <>
      <PageTitle>{t.setups.title}</PageTitle>

      {setups.length === 0 ? (
        <EmptyState icon={ClipboardList} text={t.setups.empty} action={<Button variant="primary" onClick={() => nav('/')}>{t.setups.emptyAction}</Button>} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Select
              label={t.calc.racket}
              value={racketFilter}
              onChange={setRacketFilter}
              options={[{ value: 'all', label: t.setups.all }, ...usedRackets.map((r) => ({ value: r.id, label: racketLabel(r) }))]}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{fmt(t.setups.comparePick, { n: compare.length })}</span>
              <Button variant="primary" icon={GitCompareArrows} disabled={compare.length !== 2} onClick={() => nav('/setups/compare')}>
                {t.setups.compare}
              </Button>
              {compare.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCompare}>
                  {t.common.reset}
                </Button>
              )}
            </div>
          </div>
          <ul className="grid grid-cols-1 border-b border-border md:grid-cols-2 md:gap-x-8">
            {list.map((s) => (
              <li key={s.id}>
                <SetupCard setup={s} onEdit={() => setEditing(s)} onShare={() => setSharing(s)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <SetupEditSheet setup={editing} onClose={() => setEditing(null)} />
      <ShareSheet setup={sharing} onClose={() => setSharing(null)} />
    </>
  )
}

function SetupCard({ setup: s, onEdit, onShare }: { setup: Setup; onEdit: () => void; onShare: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((x) => x.lang)
  const loadConfig = useStore((x) => x.loadConfig)
  const compare = useStore((x) => x.compare)
  const toggleCompare = useStore((x) => x.toggleCompare)
  const rackets = useAllRackets()
  const owned = useOwned()
  const toast = useToast()
  const racket = rackets.find((r) => r.id === s.racketId)
  const on = (owned ?? []).filter((o) => o.setupId === s.id && !o.retired).map((o) => o.name)
  const [mounting, setMounting] = useState<OwnedRacket | null>(null)
  const picked = compare.includes(s.id)

  const acc = (['strings', 'overgrip', 'leatherGrip', 'dampener'] as const).filter((k) => s.accessories[k]).map((k) => t.acc[k])
  const lead = leadParts(s, t, lang)

  return (
    <article className={cx('relative border-t border-border py-4 pl-4 transition-colors', picked && 'bg-surface-2/50')}>
      <span aria-hidden className={cx('absolute inset-y-4 left-0 w-0.5 rounded-full', picked ? 'bg-accent' : 'bg-transparent')} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{s.name}</h3>
          <p className="truncate text-sm text-muted">{racket ? racketLabel(racket) : t.errors.notFound}</p>
        </div>
        <button
          type="button"
          aria-label={t.setups.favourite}
          aria-pressed={s.favourite}
          onClick={() => saveSetup({ ...s, favourite: !s.favourite, updatedAt: s.updatedAt })}
          className="rounded-md p-1.5 hover:bg-surface-2"
        >
          <Star className={cx('size-[18px]', s.favourite ? 'fill-accent text-accent' : 'text-muted')} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {on.length > 0 ? (
        <p className="mt-1 text-sm font-medium text-accent-text">{fmt(t.setups.mountedOn, { names: on.join(', ') })}</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            const at = Date.now()
            setMounting({ id: uid(), name: s.name, racketId: s.racketId, setupId: s.id, createdAt: at, updatedAt: at })
          }}
          className="mt-1 flex items-center gap-1 text-sm font-medium text-accent-text underline-offset-2 hover:underline"
        >
          <Plus className="size-3.5" aria-hidden /> {t.setups.putOnRacket}
        </button>
      )}
      {mounting && <OwnedSheet value={mounting} initialBed={s.strings} onClose={() => setMounting(null)} />}
      <p className="num mt-2 text-sm">{lead.length ? lead.join(' · ') : t.setups.noLead}</p>
      {acc.length > 0 && <p className="mt-1 text-sm text-muted">{acc.join(' · ')}</p>}
      {Object.keys(s.ratings).length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STROKES.filter((k) => s.ratings[k]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <dt className="text-muted">{t.stroke[k]}</dt>
              <dd className="flex gap-0.5">
                <span className="sr-only">{s.ratings[k]}/5</span>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden className={cx('size-1.5 rounded-full', i <= s.ratings[k]! ? 'bg-bar' : 'bg-surface-2')} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex items-center gap-1">
        <span className="mr-auto text-xs text-muted">{fmt(t.setups.edited, { date: fmtDate(s.updatedAt, lang) })}</span>
        <IconButton
          icon={Calculator}
          label={t.common.open}
          onClick={() => {
            loadConfig(s, s.id)
            nav('/')
          }}
        />
        <IconButton icon={GitCompareArrows} label={t.setups.pickCompare} active={picked} aria-pressed={picked} onClick={() => toggleCompare(s.id)} />
        <IconButton icon={Pencil} label={t.common.edit} onClick={onEdit} />
        <IconButton icon={Share2} label={t.setups.share} onClick={onShare} />
        <IconButton icon={Printer} label={t.setups.sheet} onClick={() => nav(`/ficha/${s.id}`)} />
        <IconButton
          icon={Trash2}
          label={t.common.delete}
          onClick={async () => {
            await db.setups.delete(s.id)
            if (picked) toggleCompare(s.id)
            toast(t.common.deleted, { label: t.common.undo, run: () => saveSetup(s) })
          }}
        />
      </div>
    </article>
  )
}
