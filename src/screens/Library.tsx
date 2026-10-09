import { Copy, Pencil, Plus, Search, SearchX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Racket, RacketType } from '../domain/types'
import { saveRacket, uid } from '../data/db'
import { useAllRackets } from '../data/hooks'
import { defaultConfig, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum } from '../lib/format'
import { Badge, Button, EmptyState, IconButton, PageTitle, Select } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { matchesQuery } from '../ui/RacketPicker'

/** Frame types wear the colour of the sensation they lean to. */
const TYPE_COLOR: Record<RacketType, string> = {
  power: 'var(--c-power)',
  control: 'var(--c-control)',
  tweener: 'var(--c-stability)',
  junior: 'var(--c-manoeuvrability)',
}

export function Library() {
  const t = useT()
  const nav = useNavigate()
  const all = useAllRackets()
  const [q, setQ] = useState('')
  const [type, setType] = useState<RacketType | 'all'>('all')
  const [brand, setBrand] = useState('all')

  const brands = useMemo(() => [...new Set(all.map((r) => r.brand))].sort(), [all])
  const list = useMemo(
    () => all.filter((r) => (type === 'all' || r.type === type) && (brand === 'all' || r.brand === brand) && matchesQuery(r, q)),
    [all, q, type, brand],
  )
  const filtered = q || type !== 'all' || brand !== 'all'

  return (
    <>
      <PageTitle
        action={
          <Button variant="primary" icon={Plus} onClick={() => nav('/rackets/new')}>
            {t.library.add}
          </Button>
        }
      >
        {t.library.title}
      </PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="lib-q" className="mb-1.5 block text-sm text-muted">
            {t.library.search}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="lib-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 w-full rounded-md border border-border-input bg-bg pl-9 pr-3"
            />
          </div>
        </div>
        <Select
          label={t.library.type}
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t.library.all },
            ...(['power', 'tweener', 'control', 'junior'] as const).map((v) => ({ value: v, label: t.library.types[v] })),
          ]}
        />
        <Select label={t.library.brand} value={brand} onChange={setBrand} options={[{ value: 'all', label: t.library.all }, ...brands.map((b) => ({ value: b, label: b }))]} />
      </div>

      <p className="mb-3 text-sm text-muted md:hidden">{t.library.strungNote}</p>
      <p className="sr-only" aria-live="polite">
        {fmt(t.library.count, { n: list.length })}
      </p>

      {list.length === 0 ? (
        <EmptyState
          icon={SearchX}
          text={t.library.empty}
          action={
            filtered && (
              <Button
                onClick={() => {
                  setQ('')
                  setType('all')
                  setBrand('all')
                }}
              >
                {t.library.clearFilters}
              </Button>
            )
          }
        />
      ) : (
        <div className="border-b border-border">
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_repeat(5,72px)_auto] gap-x-4 pb-2 text-right text-xs text-muted md:grid">
            <span className="text-left">{t.library.strungNote}</span>
            <span>{t.spec.weight}</span>
            <span>{t.spec.balance}</span>
            <span>SW</span>
            <span>{t.spec.headSize}</span>
            <span>{t.library.pattern}</span>
            <span className="w-[76px]" />
          </div>
          <ul>
            {list.map((r) => (
              <li key={r.id}>
                <RacketCard racket={r} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function RacketCard({ racket: r }: { racket: Racket }) {
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const loadConfig = useStore((s) => s.loadConfig)
  const toast = useToast()

  const openInCalc = () => {
    loadConfig(defaultConfig(r.id), null)
    nav('/')
  }
  const duplicate = async () => {
    const now = Date.now()
    const copy: Racket = { ...r, id: uid(), isStock: false, model: `${r.model} (2)`, source: undefined, createdAt: now, updatedAt: now }
    await saveRacket(copy)
    toast(t.common.saved)
    nav(`/rackets/${copy.id}`)
  }

  const spec = r.strung ?? { weightG: r.weightG, balanceCm: r.balanceCm, swingweight: r.swingweight }
  const cells = [
    `${fmtNum(spec.weightG, 0, lang)} g`,
    `${fmtNum(spec.balanceCm * 10, 0, lang)} mm`,
    fmtNum(spec.swingweight, 0, lang),
    `${r.headSizeSqIn} in²`,
    r.pattern ?? '—',
  ]

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-border py-3 md:grid-cols-[minmax(0,1fr)_repeat(5,72px)_auto]">
      <div className="min-w-0">
        <h3 className="truncate leading-snug">
          <span className="text-muted">{r.brand} </span>
          <span className="font-medium">{r.model}</span>
          {r.year && <span className="text-muted"> {r.year}</span>}
        </h3>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full" style={{ background: TYPE_COLOR[r.type] }} />
            {t.library.types[r.type]}
          </span>
          {!r.isStock && <Badge tone="accent">{t.library.custom}</Badge>}
        </p>
        <p className="num mt-1 text-sm text-muted md:hidden">{[cells[0], cells[1], `${cells[2]} SW`, cells[3], cells[4]].join(' · ')}</p>
      </div>
      {cells.map((c, i) => (
        <span key={i} className="num hidden text-right text-sm md:block">
          {c}
        </span>
      ))}
      <div className="flex justify-end gap-1">
        <IconButton icon={SlidersHorizontal} label={t.library.useInCalc} onClick={openInCalc} />
        <IconButton icon={Copy} label={t.common.duplicate} onClick={duplicate} />
        {!r.isStock && <IconButton icon={Pencil} label={t.common.edit} onClick={() => nav(`/rackets/${r.id}`)} />}
      </div>
    </article>
  )
}

