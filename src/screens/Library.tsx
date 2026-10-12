import { CircleCheck, Copy, Diamond, Pencil, Plus, Ruler, Search, SearchX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Racket, RacketType } from '../domain/types'
import { saveRacket, uid } from '../data/db'
import { useAllRackets } from '../data/hooks'
import { defaultConfig, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum } from '../lib/format'
import { Badge, Button, Card, CardTitle, EmptyState, IconButton, PageTitle, Select } from '../ui/basics'
import { InfoTip } from '../ui/disclosure'
import { MyRacketsSection } from '../ui/MyRackets'
import { RacketMap } from '../ui/RacketMap'
import { useToast } from '../ui/overlay'
import { matchesQuery } from '../ui/RacketPicker'

/** Frame types wear the colour of the sensation they lean to. */
const TYPE_COLOR: Record<RacketType, string> = {
  power: 'var(--c-power)',
  control: 'var(--c-control)',
  tweener: 'var(--c-stability)',
  junior: 'var(--c-manoeuvrability)',
}

type Sort = 'brand' | 'weight' | 'balance' | 'swingweight'
const SORTS: Sort[] = ['brand', 'weight', 'balance', 'swingweight']

const byBrand = (a: Racket, b: Racket) => a.brand.localeCompare(b.brand) || (b.year ?? 0) - (a.year ?? 0) || a.model.localeCompare(b.model)
const SORT_BY: Record<Sort, (a: Racket, b: Racket) => number> = {
  brand: byBrand,
  weight: (a, b) => a.weightG - b.weightG || byBrand(a, b),
  balance: (a, b) => a.balanceCm - b.balanceCm || byBrand(a, b),
  swingweight: (a, b) => a.swingweight - b.swingweight || byBrand(a, b),
}

export function Library() {
  const t = useT()
  const nav = useNavigate()
  const all = useAllRackets()
  const [q, setQ] = useState('')
  const [type, setType] = useState<RacketType | 'all'>('all')
  const [brand, setBrand] = useState('all')
  const [sort, setSort] = useState<Sort>('brand')
  const mapIds = useStore((s) => s.mapIds)
  const toggleMap = useStore((s) => s.toggleMap)
  const picked = useMemo(() => mapIds.map((id) => all.find((r) => r.id === id)).filter((r): r is Racket => !!r), [mapIds, all])

  const brands = useMemo(() => [...new Set(all.map((r) => r.brand))].sort(), [all])
  const list = useMemo(
    () => all.filter((r) => (type === 'all' || r.type === type) && (brand === 'all' || r.brand === brand) && matchesQuery(r, q)).sort(SORT_BY[sort]),
    [all, q, type, brand, sort],
  )
  // Sorted by brand, the list reads as one section per brand.
  const groups = useMemo(() => {
    if (sort !== 'brand') return [{ name: '', items: list }]
    const out: { name: string; items: Racket[] }[] = []
    for (const r of list) {
      if (out.at(-1)?.name !== r.brand) out.push({ name: r.brand, items: [] })
      out.at(-1)!.items.push(r)
    }
    return out
  }, [list, sort])
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

      <div className="mb-3 grid grid-cols-3 gap-2 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] md:gap-3">
        <div className="col-span-3 md:col-span-1">
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
        <Select label={t.library.sort} value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s, label: t.library.sorts[s] }))} />
      </div>

      <p className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <Ruler className="size-4 shrink-0" aria-hidden />
        {t.library.stockNote}
      </p>
      <MyRacketsSection />

      <Card label={t.library.map.title} className="mb-6">
        <CardTitle info={<InfoTip title={t.library.map.title}>{t.library.map.info}</InfoTip>}>{t.library.map.title}</CardTitle>
        <RacketMap all={all} picked={picked} onRemove={toggleMap} />
      </Card>

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
        <div className="space-y-8">
          {groups.map((grp) => (
            <section key={grp.name || 'all'} aria-label={grp.name || undefined}>
              {grp.name && (
                <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold tracking-tight">
                  {grp.name}
                  <span className="num text-sm font-normal text-muted">{grp.items.length}</span>
                </h2>
              )}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grp.items.map((r) => (
                  <li key={r.id} className="flex">
                    <RacketCard racket={r} showBrand={!grp.name} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function RacketCard({ racket: r, showBrand }: { racket: Racket; showBrand: boolean }) {
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const loadConfig = useStore((s) => s.loadConfig)
  const onMap = useStore((s) => s.mapIds.includes(r.id))
  const toggleMap = useStore((s) => s.toggleMap)
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

  // Stock specs: unstrung, no overgrip, as the frame leaves the factory.
  const pts = (r.lengthCm / 2 - r.balanceCm) / 0.3175
  const official = r.specFrom?.weight === 'official'
  const facts = [`${r.headSizeSqIn} in²`, r.pattern, r.ra && `RA ${r.ra}`, Math.abs(r.lengthCm - 68.58) > 0.3 && `${fmtNum(r.lengthCm, 1, lang)} cm`].filter(Boolean)

  return (
    <article className="flex w-full flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[r.type] }} />
            {showBrand ? `${r.brand} · ` : ''}
            {t.library.types[r.type]}
          </p>
          <h3 className="mt-0.5 font-semibold leading-snug">
            {!showBrand && <span className="sr-only">{r.brand} </span>}
            {r.model}
            {r.year && <span className="num font-normal text-muted"> {r.year}</span>}
          </h3>
        </div>
        {!r.isStock ? (
          <Badge tone="accent">{t.library.custom}</Badge>
        ) : official ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success" title={t.library.officialHint}>
            <CircleCheck className="size-3.5" aria-hidden />
            {t.library.official}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted" title={t.library.measuredHint}>
            {t.library.measured}
          </span>
        )}
      </div>

      <dl className="num my-3 grid grid-cols-3 gap-2 border-y border-border py-3">
        <div>
          <dt className="text-xs text-muted">{t.spec.weight}</dt>
          <dd className="readout text-lg">
            {fmtNum(r.weightG, 0, lang)}
            <span className="ml-0.5 text-xs font-normal text-muted">g</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t.spec.balance}</dt>
          <dd className="readout text-lg">
            {fmtNum(r.balanceCm * 10, 0, lang)}
            <span className="ml-0.5 text-xs font-normal text-muted">mm</span>
          </dd>
          <dd className="text-xs text-muted">
            {fmtNum(Math.abs(pts), 1, lang)} {pts >= 0 ? t.units.pts : t.units.ptsHH}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">SW</dt>
          <dd className="readout text-lg">{fmtNum(r.swingweight, 0, lang)}</dd>
        </div>
      </dl>

      <p className="num mb-3 text-sm text-muted">{facts.join(' · ')}</p>

      <div className="mt-auto flex items-center gap-1">
        <Button variant="secondary" size="sm" icon={SlidersHorizontal} className="mr-auto" onClick={openInCalc}>
          {t.library.useInCalc}
        </Button>
        <IconButton icon={Diamond} label={onMap ? t.library.map.remove : t.library.map.add} active={onMap} aria-pressed={onMap} onClick={() => toggleMap(r.id)} />
        <IconButton icon={Copy} label={t.common.duplicate} onClick={duplicate} />
        {!r.isStock && <IconButton icon={Pencil} label={t.common.edit} onClick={() => nav(`/rackets/${r.id}`)} />}
      </div>
    </article>
  )
}
