import { Calculator, ClipboardList, GitCompareArrows, Pencil, Plus, Printer, Share2, Star, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OwnedRacket } from '../domain/journal'
import { STROKES, type Setup } from '../domain/types'
import { db, saveSetup, uid } from '../data/db'
import { useAllRackets, useOwned, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum, leadParts, racketLabel } from '../lib/format'
import { compute } from '../domain/physics'
import { bedLabel } from '../lib/bedLabel'
import { Button, cx, EmptyState, PageTitle, Select } from '../ui/basics'
import { MoreMenu } from '../ui/menu'
import { useToast } from '../ui/overlay'
import { OwnedSheet } from './JournalSheets'
import { SetupEditSheet } from './SetupEdit'
import { ShareSheet } from './ShareSheet'
import { useUnits } from '../lib/units'

export function Setups() {
  const t = useT()
  const nav = useNavigate()
  const setups = useSetups()
  const rackets = useAllRackets()
  const compare = useStore((s) => s.compare)
  const clearCompare = useStore((s) => s.clearCompare)
  const toggleCompare = useStore((s) => s.toggleCompare)
  const [racketFilter, setRacketFilter] = useState('all')
  const [editing, setEditing] = useState<Setup | null>(null)
  const [sharing, setSharing] = useState<Setup | null>(null)
  // Picking two setups to compare, with a box on each card.
  const [selecting, setSelecting] = useState(false)

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
  // Only setups that still exist count as picked.
  const picked = compare.filter((id) => setups?.some((s) => s.id === id))

  if (setups === undefined) return null

  const startCompare = (id?: string) => {
    clearCompare()
    if (id) toggleCompare(id)
    setSelecting(true)
  }
  const stopCompare = () => {
    clearCompare()
    setSelecting(false)
  }

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
            {setups.length > 1 && (
              <Button icon={selecting ? X : GitCompareArrows} aria-pressed={selecting} onClick={() => (selecting ? stopCompare() : startCompare())}>
                {selecting ? t.common.cancel : t.setups.compare}
              </Button>
            )}
          </div>
          {selecting && <p className="mb-2 text-sm text-muted">{t.setups.selectHint}</p>}
          <ul className={cx('grid grid-cols-1 border-b border-border md:grid-cols-2 md:gap-x-8', selecting && 'mb-20')}>
            {list.map((s) => (
              <li key={s.id} className="min-w-0">
                <SetupCard
                  setup={s}
                  selecting={selecting}
                  picked={picked.includes(s.id)}
                  // Two at most: the others wait until one is unticked.
                  full={picked.length >= 2}
                  onPick={() => toggleCompare(s.id)}
                  onCompare={() => startCompare(s.id)}
                  onEdit={() => setEditing(s)}
                  onShare={() => setSharing(s)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {selecting && (
        <div
          role="region"
          aria-label={t.setups.compare}
          className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-56"
        >
          <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3">
            <span className="text-sm font-medium" aria-live="polite">
              {picked.length === 1 ? t.setups.selectedOne : fmt(t.setups.selected, { n: picked.length })}
            </span>
            <div className="flex items-center gap-2">
              {/* The second place can be a pro. */}
              {picked.length === 1 && (
                <Button icon={UserRound} onClick={() => nav(`/setups/pro/${picked[0]}`)}>
                  {t.setups.withPro}
                </Button>
              )}
              <Button variant="primary" icon={GitCompareArrows} disabled={picked.length !== 2} onClick={() => nav('/setups/compare')}>
                {t.setups.compare}
              </Button>
            </div>
          </div>
        </div>
      )}

      <SetupEditSheet setup={editing} onClose={() => setEditing(null)} />
      <ShareSheet setup={sharing} onClose={() => setSharing(null)} />
    </>
  )
}

function SetupCard({
  setup: s,
  selecting,
  picked,
  full,
  onPick,
  onCompare,
  onEdit,
  onShare,
}: {
  setup: Setup
  selecting: boolean
  picked: boolean
  full: boolean
  onPick: () => void
  onCompare: () => void
  onEdit: () => void
  onShare: () => void
}) {
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((x) => x.lang)
  const u = useUnits()
  const masses = useStore((x) => x.masses)
  const loadConfig = useStore((x) => x.loadConfig)
  const compare = useStore((x) => x.compare)
  const toggleCompare = useStore((x) => x.toggleCompare)
  const rackets = useAllRackets()
  const owned = useOwned()
  const toast = useToast()
  const racket = rackets.find((r) => r.id === s.racketId)
  const on = (owned ?? []).filter((o) => o.setupId === s.id && !o.retired).map((o) => o.name)
  const [mounting, setMounting] = useState<OwnedRacket | null>(null)
  // As it plays: strings and accessories on, as the calculator shows it.
  const result = useMemo(() => (racket ? compute({ spec: racket, ...s, masses }).result : undefined), [racket, s, masses])

  const acc = (['strings', 'overgrip', 'leatherGrip', 'dampener'] as const).filter((k) => s.accessories[k]).map((k) => t.acc[k])
  const lead = leadParts(s, t, lang)
  const open = () => {
    loadConfig(s, s.id)
    nav('/')
  }

  return (
    <article aria-label={s.name} className={cx('relative border-t border-border py-4 pl-4 transition-colors', picked && 'bg-surface-2/50')}>
      <span aria-hidden className={cx('absolute inset-y-4 left-0 w-0.5 rounded-full', picked ? 'bg-accent' : 'bg-transparent')} />
      <div className="flex items-start justify-between gap-2">
        {selecting && (
          <input
            type="checkbox"
            checked={picked}
            disabled={!picked && full}
            onChange={onPick}
            aria-label={fmt(t.setups.pickOne, { name: s.name })}
            className="mt-1 size-5 shrink-0 accent-[var(--c-accent)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{s.name}</h2>
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
      {result && (
        <p className="num mt-2 text-sm font-medium">
          {u.weight(result.weightG)} {u.weightUnit} · {u.balance(result.balanceCm)} {u.balanceUnit} · SW {fmtNum(result.swingweight, 0, lang)}
        </p>
      )}
      {s.strings && (
        <p className="num mt-0.5 text-sm text-muted wrap-anywhere">
          {t.strings.title}: {bedLabel(s.strings, t, lang)}
        </p>
      )}
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
      <div className="mt-3 flex items-center gap-2">
        <span className="mr-auto min-w-0 truncate whitespace-nowrap text-xs text-muted">{fmt(t.setups.edited, { date: fmtDate(s.updatedAt, lang) })}</span>
        <Button size="sm" icon={Calculator} onClick={open} aria-label={`${t.common.open}: ${s.name}`}>
          {t.common.open}
        </Button>
        <MoreMenu
          label={fmt(t.setups.more, { name: s.name })}
          items={[
            { label: t.setups.compare, icon: GitCompareArrows, onSelect: onCompare },
            { label: t.setups.comparePro, icon: UserRound, onSelect: () => nav(`/setups/pro/${s.id}`) },
            { label: t.common.edit, icon: Pencil, onSelect: onEdit },
            { label: t.setups.share, icon: Share2, onSelect: onShare },
            { label: t.setups.sheet, icon: Printer, onSelect: () => nav(`/ficha/${s.id}`) },
            {
              label: t.common.delete,
              icon: Trash2,
              danger: true,
              onSelect: async () => {
                await db.setups.delete(s.id)
                if (compare.includes(s.id)) toggleCompare(s.id)
                toast(t.common.deleted, { label: t.common.undo, run: () => saveSetup(s) })
              },
            },
          ]}
        />
      </div>
    </article>
  )
}
