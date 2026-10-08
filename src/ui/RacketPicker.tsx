import { ChevronDown, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Racket } from '../domain/types'
import { useAllRackets } from '../data/hooks'
import { useT } from '../i18n'
import { cx } from './basics'
import { Sheet } from './overlay'

export function matchesQuery(r: Racket, q: string) {
  const s = `${r.brand} ${r.model} ${r.year ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => s.includes(w))
}

export function RacketPicker({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string
  value: Racket | undefined
  onChange: (r: Racket) => void
  exclude?: string[]
}) {
  const t = useT()
  const id = useId()
  const all = useAllRackets()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = useMemo(() => all.filter((r) => !exclude?.includes(r.id) && matchesQuery(r, q)), [all, q, exclude])

  return (
    <div>
      <label id={`${id}-l`} htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-md border border-border-input bg-bg px-3 text-left"
      >
        {value ? (
          <span id={`${id}-v`} className="truncate">
            <span className="text-muted">{value.brand} </span>
            <span className="font-semibold">{value.model}</span>
            {value.year && <span className="text-muted"> ({value.year})</span>}
          </span>
        ) : (
          <span id={`${id}-v`} className="text-muted">
            {t.library.search}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.library.search}
            aria-label={t.library.search}
            className="h-11 w-full rounded-md border border-border-input bg-bg pl-9 pr-3"
          />
        </div>
        <ul className="-mx-2 max-h-[55dvh] overflow-y-auto">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(r)
                  setOpen(false)
                  setQ('')
                }}
                className={cx(
                  'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-surface-2',
                  value?.id === r.id && 'bg-surface-2',
                )}
              >
                <span>
                  <span className="text-muted">{r.brand} </span>
                  <span className="font-semibold">{r.model}</span>
                  {r.year && <span className="text-muted"> ({r.year})</span>}
                </span>
                {!r.isStock && <span className="text-xs font-bold text-accent-text">{t.library.custom}</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t.library.empty}</li>}
        </ul>
      </Sheet>
    </div>
  )
}
