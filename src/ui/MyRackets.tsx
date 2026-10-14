import { Calculator, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uid } from '../data/db'
import { useAllRackets, useOwned, useSetups, useStringings } from '../data/hooks'
import { defaultConfig, useStore } from '../data/store'
import { latestOf, type OwnedRacket } from '../domain/journal'
import { useT } from '../i18n'
import { OwnedSheet } from '../screens/JournalSheets'
import { Badge, Button, IconButton, cx } from './basics'
import { bedLabel } from './strings'

/** Loads one of the player's rackets into the calculator: its setup if it
 *  has one (else the stock frame), with the strings on it now. */
export function useOpenOwned() {
  const loadConfig = useStore((s) => s.loadConfig)
  const setups = useSetups()
  const stringings = useStringings()
  return (o: OwnedRacket) => {
    const setup = setups?.find((s) => s.id === o.setupId)
    const base = setup ?? defaultConfig(o.racketId)
    const strings = latestOf(o.id, stringings ?? [])?.bed ?? base.strings
    loadConfig({ ...base, racketId: setup?.racketId ?? o.racketId, strings }, setup?.id ?? null)
  }
}

/** Calculator: the player's rackets as chips under the frame picker. */
export function MyRacketsRow() {
  const t = useT()
  const owned = useOwned()
  const config = useStore((s) => s.config)
  const loadedSetupId = useStore((s) => s.loadedSetupId)
  const open = useOpenOwned()
  const active = (owned ?? []).filter((o) => !o.retired)
  if (!active.length) return null
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">{t.journal.myRackets}</span>
      <div className="flex flex-wrap gap-2">
        {active.map((o) => {
          const on = config.racketId === o.racketId && (o.setupId ? loadedSetupId === o.setupId : !loadedSetupId)
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => open(o)}
              className={cx(
                'min-h-10 rounded-full border px-3.5 text-sm transition-colors',
                on ? 'border-text bg-text font-semibold text-bg' : 'border-border-input hover:bg-surface-2',
              )}
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Rackets tab: the player's own rackets, to open in the calculator or edit. */
export function MyRacketsSection() {
  const t = useT()
  const nav = useNavigate()
  const owned = useOwned()
  const stringings = useStringings()
  const rackets = useAllRackets()
  const config = useStore((s) => s.config)
  const lang = useStore((s) => s.lang)
  const open = useOpenOwned()
  const [editing, setEditing] = useState<OwnedRacket | null>(null)
  const add = () => {
    const at = Date.now()
    setEditing({ id: uid(), name: '', racketId: config.racketId, createdAt: at, updatedAt: at })
  }
  if (owned === undefined) return null
  return (
    <section aria-label={t.journal.myRackets} className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-md font-semibold tracking-tight">{t.journal.myRackets}</h2>
        <Button size="sm" variant="ghost" icon={Plus} onClick={add}>
          {t.journal.addRacket}
        </Button>
      </div>
      {owned.length === 0 ? (
        <p className="text-sm text-muted">{t.library.mineEmpty}</p>
      ) : (
        // grid-cols-1 is minmax(0, 1fr): a long line cannot widen the page
        // (Safari sizes a plain 1fr column to its widest unbreakable line).
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {owned.map((o) => {
            const r = rackets.find((x) => x.id === o.racketId)
            const st = latestOf(o.id, stringings ?? [])
            return (
              <li key={o.id} className={cx('flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface p-3', o.retired && 'opacity-60')}>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {o.name}
                    {o.retired && <Badge>{t.journal.retiredBadge}</Badge>}
                  </p>
                  {r && <p className="truncate text-sm text-muted">{`${r.brand} ${r.model}`}</p>}
                  {/* The strings may be long (a hybrid with names): they wrap. */}
                  {st && <p className="num text-sm text-muted wrap-anywhere">{bedLabel(st.bed, t, lang)}</p>}
                </div>
                <IconButton
                  icon={Calculator}
                  label={`${t.library.useInCalc}: ${o.name}`}
                  onClick={() => {
                    open(o)
                    nav('/')
                  }}
                />
                <IconButton icon={Pencil} label={`${t.common.edit} ${o.name}`} onClick={() => setEditing(o)} />
              </li>
            )
          })}
        </ul>
      )}
      {editing && <OwnedSheet value={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
