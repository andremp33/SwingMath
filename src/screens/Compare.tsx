import { ArrowLeft, GitCompareArrows, Target as TargetIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Feel } from '../domain/feel'
import { FEEL_KEYS } from '../domain/feel'
import { stringbedIndex, type Stringbed } from '../domain/strings'
import { POSITIONS, STROKES, type Racket, type Setup, type Specs } from '../domain/types'
import { useComputed, useRacket, useSetups } from '../data/hooks'
import { racketFeel } from '../data/racketFeel'
import { shortName } from '../data/stringCatalog'
import { PRO_TARGETS, withStrings, type ProTarget } from '../data/pros'
import { defaultConfig, useStore } from '../data/store'
import { compute, ptsHeadLight, recoilWeight } from '../domain/physics'
import { fmt, useT, type Dict } from '../i18n'
import { bedLabel } from '../lib/bedLabel'
import { extraLabel, fmtNum, racketLabel } from '../lib/format'
import { Badge, Button, Card, CardTitle, cx, EmptyState, PageTitle } from '../ui/basics'
import { monthYear, ProList } from '../ui/ProPicker'
import type { MatchHandoff } from './Match'
import { useUnits } from '../lib/units'
import { InfoTip } from '../ui/disclosure'

export function Compare() {
  const t = useT()
  const nav = useNavigate()
  const ids = useStore((s) => s.compare)
  const setups = useSetups()
  const a = setups?.find((s) => s.id === ids[0])
  const b = setups?.find((s) => s.id === ids[1])

  return (
    <>
      <PageTitle>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => nav('/setups')} aria-label={t.common.back} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {t.compare.title}
        </span>
      </PageTitle>
      {setups === undefined ? null : !a || !b ? (
        <EmptyState icon={GitCompareArrows} text={t.compare.need2} action={<Button onClick={() => nav('/setups')}>{t.compare.pick}</Button>} />
      ) : (
        <TwoSetups a={a} b={b} />
      )}
    </>
  )
}

function TwoSetups({ a, b }: { a: Setup; b: Setup }) {
  const ra = useRacket(a.racketId)
  const rb = useRacket(b.racketId)
  const ca = useComputed(a, ra)
  const cb = useComputed(b, rb)
  const t = useT()
  const lang = useStore((s) => s.lang)
  if (!ra || !rb || !ca || !cb) return null
  return <CompareView a={setupSide(a, ra, ca.result, t, lang)} b={setupSide(b, rb, cb.result, t, lang)} />
}

/** One column of the comparison: a saved setup, or (later) a pro. Numbers
 *  the side has no source for are left out and show as "—". */
export interface CompareSide {
  id: string
  title: string
  racket: string
  strings?: string
  /** Under the title: where the numbers come from, for a pro. */
  about?: ReactNode
  specs: Partial<Pick<Specs, 'weightG' | 'balanceCm' | 'swingweight' | 'twistweight' | 'recoilWeight' | 'sweetSpotCm'>>
  stringName?: string
  tensionKg?: number
  /** The tension as the source says it ("27–28 / 26–27 kg"), for a pro. */
  tensionText?: string
  stiffness?: number
  accessories?: string
  feel?: Feel
  /** Estimated from the frame (a pro's stock racquet): said so. */
  feelEstimated?: boolean
  setup?: Setup
}

const stringsName = (bed: Stringbed, t: Dict) => {
  const one = (s: Stringbed['mains']) => (s.name?.trim() ? shortName(s.name) : t.strings.short[s.material])
  return bed.crosses ? `${one(bed.mains)} / ${one(bed.crosses)}` : one(bed.mains)
}

export function setupSide(s: Setup, r: Racket, result: Specs, t: Dict, lang: string): CompareSide {
  const acc = (['strings', 'overgrip', 'leatherGrip', 'dampener'] as const).filter((k) => s.accessories[k]).map((k) => t.acc[k])
  return {
    id: s.id,
    title: s.name,
    racket: racketLabel(r),
    strings: s.strings && bedLabel(s.strings, t, lang),
    specs: result,
    stringName: s.strings && stringsName(s.strings, t),
    tensionKg: s.strings?.mains.tensionKg,
    stiffness: s.strings && stringbedIndex(r, s.strings),
    accessories: acc.length ? acc.join(' · ') : '—',
    feel: racketFeel(r, result, s.strings),
    setup: s,
  }
}

/** The two sides' marks, the same in the header, the legend and the bars. */
const MARK = ['bg-text', 'bg-muted'] as const

function Mark({ i }: { i: 0 | 1 }) {
  return <span aria-hidden className={cx('inline-block size-2.5 shrink-0 rounded-full', MARK[i])} />
}

/** "↑ 1,0" when the second is higher, "↓" lower, "=" the same. Neutral:
 *  higher is not better or worse by itself. */
function Diff({ a, b, digits }: { a?: number; b?: number; digits: number }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  if (a === undefined || b === undefined) return <span className="text-muted">—</span>
  const d = Math.round((b - a) * 10 ** digits) / 10 ** digits
  if (d === 0) return <span className="text-muted">=</span>
  return (
    <span>
      <span aria-hidden>{d > 0 ? '↑' : '↓'}</span>
      <span className="sr-only">{d > 0 ? t.compare.more : t.compare.less}</span> {fmtNum(Math.abs(d), digits, lang)}
    </span>
  )
}

export function CompareView({ a, b, below }: { a: CompareSide; b: CompareSide; below?: ReactNode }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const u = useUnits()
  const num = (v: number | undefined, digits: number, unit?: string) => (v === undefined ? '—' : `${fmtNum(v, digits, lang)}${unit ? ` ${unit}` : ''}`)

  // Weight and balance in the player's units (oz to hundredths, in to hundredths).
  const w = (g?: number) => (g === undefined ? undefined : u.toWeight(g))
  const bal = (cm?: number) => (cm === undefined ? undefined : u.toBalanceMm(cm * 10))
  const len = (cm?: number) => (cm === undefined ? undefined : u.imperial ? cm / 2.54 : cm)
  const specRows: [string, number | undefined, number | undefined, number, string?][] = [
    [t.spec.weight, w(a.specs.weightG), w(b.specs.weightG), u.imperial ? 2 : 1, u.weightUnit],
    [t.spec.balance, bal(a.specs.balanceCm), bal(b.specs.balanceCm), u.imperial ? 2 : 1, u.balanceUnit],
    [t.spec.swingweight, a.specs.swingweight, b.specs.swingweight, 1],
    [t.spec.twistweight, a.specs.twistweight, b.specs.twistweight, 2],
    [t.spec.recoil, a.specs.recoilWeight, b.specs.recoilWeight, 1],
    [t.spec.sweetSpot, len(a.specs.sweetSpotCm), len(b.specs.sweetSpotCm), 1, u.lengthUnit],
  ]
  const head = (s: CompareSide, i: 0 | 1) => (
    <th scope="col" className="pb-3 pl-2 text-left align-bottom font-normal">
      <span className="flex items-center gap-1.5 font-bold hyphens-auto">
        <Mark i={i} /> <span className="min-w-0 wrap-anywhere">{s.title}</span>
      </span>
      <span className="block text-xs text-muted wrap-anywhere">{s.racket}</span>
      {s.strings && <span className="block text-xs text-muted wrap-anywhere">{s.strings}</span>}
      {s.about}
    </th>
  )
  const row = (label: string, va: ReactNode, vb: ReactNode, diff: ReactNode) => (
    <tr key={label}>
      <th scope="row" className="py-2 pr-2 text-left font-normal text-muted">
        {label}
      </th>
      <td className="py-2 pl-2 font-semibold">{va}</td>
      <td className="py-2 pl-2 font-semibold">{vb}</td>
      <td className="whitespace-nowrap py-2 pl-2 text-right text-xs font-semibold">{diff}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <Card>
        <table className="num w-full table-fixed text-sm">
          {/* On a phone the two sides get the room: narrower labels and difference. */}
          <colgroup>
            <col className="w-[22%] sm:w-[26%]" />
            <col />
            <col />
            <col className="w-[15%] sm:w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <td className="pb-3" />
              {head(a, 0)}
              {head(b, 1)}
              <th scope="col" className="pb-3 pl-2 text-right align-bottom text-xs font-normal text-muted">
                {t.compare.diff}
                <span className="block">{t.compare.diffHint}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {specRows.map(([label, va, vb, d, unit]) => row(label, num(va, d, unit), num(vb, d, unit), <Diff a={va} b={vb} digits={d} />))}
          </tbody>
          <tbody className="divide-y divide-border/70 border-t-2 border-border">
            {row(t.compare.string, a.stringName ?? '—', b.stringName ?? '—', '')}
            {row(
              t.strings.tension,
              a.tensionText ?? num(a.tensionKg, 1, 'kg'),
              b.tensionText ?? num(b.tensionKg, 1, 'kg'),
              <Diff a={a.tensionKg} b={b.tensionKg} digits={1} />,
            )}
            {row(t.compare.stiffness, num(a.stiffness, 0), num(b.stiffness, 0), <Diff a={a.stiffness} b={b.stiffness} digits={0} />)}
            {row(t.acc.title, a.accessories ?? '—', b.accessories ?? '—', '')}
          </tbody>
        </table>
      </Card>
      {below}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Only with something to estimate it from (a pro's stock frame). */}
        {a.feel && b.feel && (
          <Card label={t.calc.feel}>
            <CardTitle info={(a.feelEstimated || b.feelEstimated) && <InfoTip title={t.calc.feel}>{t.compare.feelEstimated}</InfoTip>}>{t.calc.feel}</CardTitle>
            <FeelBars a={a} b={b} />
          </Card>
        )}
        {a.setup && b.setup && <RatingsAndLead a={a.setup} b={b.setup} />}
      </div>
    </div>
  )
}

/** Each feel, the two sides as bars one under the other, with their
 *  numbers; the legend uses the same marks as the table. */
function FeelBars({ a, b }: { a: CompareSide; b: CompareSide }) {
  const t = useT()
  return (
    <div>
      <ul className="mb-3 space-y-1 text-xs text-muted" aria-label={t.compare.legend}>
        {[a, b].map((s, i) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <Mark i={i as 0 | 1} /> <span className="wrap-anywhere">{s.title}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        {FEEL_KEYS.map((k) => (
          <div key={k}>
            <p className="mb-1 text-sm">{t.feel[k]}</p>
            {[a, b].map((s, i) => {
              const v = Math.round(s.feel![k])
              return (
                <div key={s.id} role="meter" aria-label={`${t.feel[k]}: ${s.title}`} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2">
                  <span aria-hidden className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                    <span className={cx('absolute inset-y-0 left-0 rounded-full', MARK[i])} style={{ width: `${v}%` }} />
                  </span>
                  <span className="num text-right text-xs font-semibold">{v}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function RatingsAndLead({ a, b }: { a: Setup; b: Setup }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  // Custom positions of either setup, matched by their name ("11h e 1h").
  const m = new Map<string, [number, number]>()
  for (const e of a.extra ?? []) {
    const k = extraLabel(e, t, lang)
    m.set(k, [(m.get(k)?.[0] ?? 0) + e.grams, m.get(k)?.[1] ?? 0])
  }
  for (const e of b.extra ?? []) {
    const k = extraLabel(e, t, lang)
    m.set(k, [m.get(k)?.[0] ?? 0, (m.get(k)?.[1] ?? 0) + e.grams])
  }
  const pair = (x: ReactNode, y: ReactNode) => (
    <>
      {x} <span className="text-muted">/</span> {y}
    </>
  )
  return (
    <Card>
      <CardTitle>{t.setups.ratings}</CardTitle>
      <dl className="space-y-2 text-sm">
        {STROKES.map((k) => (
          <div key={k} className="flex justify-between">
            <dt className="text-muted">{t.stroke[k]}</dt>
            <dd className="num font-semibold">{pair(a.ratings[k] ?? '—', b.ratings[k] ?? '—')}</dd>
          </div>
        ))}
      </dl>
      <CardTitle>
        <span className="mt-4 block">{t.calc.lead}</span>
      </CardTitle>
      <dl className="space-y-2 text-sm">
        {POSITIONS.map((p) => (
          <div key={p} className="flex justify-between">
            <dt className="text-muted">{t.pos[p]}</dt>
            <dd className="num font-semibold">
              {pair(fmtNum(a.leadG[p], 1, lang), fmtNum(b.leadG[p], 1, lang))} g
            </dd>
          </div>
        ))}
        {[...m].map(([label, [ga, gb]]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted">{label}</dt>
            <dd className="num font-semibold">
              {pair(fmtNum(ga, 1, lang), fmtNum(gb, 1, lang))} g
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">{fmt(t.compare.order, { a: a.name, b: b.name })}</p>
    </Card>
  )
}

/** A saved setup next to a pro: both strung. The pro's numbers are the
 *  source's, converted to strung when it measured the bare frame, and only
 *  those it published; the feel only from the pro's stock frame, and said
 *  to be estimated. */
export function ProCompare() {
  const t = useT()
  const nav = useNavigate()
  const setLastPro = useStore((s) => s.setLastPro)
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const setups = useSetups()
  const setup = setups?.find((s) => s.id === id)
  const pro = PRO_TARGETS.find((p) => p.id === params.get('pro'))

  return (
    <>
      <PageTitle>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => nav('/setups')} aria-label={t.common.back} className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {t.compare.proTitle}
        </span>
      </PageTitle>
      {setups === undefined ? null : !setup ? (
        <EmptyState icon={GitCompareArrows} text={t.errors.notFound} action={<Button onClick={() => nav('/setups')}>{t.compare.pick}</Button>} />
      ) : !pro ? (
        <Card label={t.compare.pickPro}>
          <CardTitle>{t.compare.pickPro}</CardTitle>
          <p className="mb-3 text-sm text-muted">{fmt(t.compare.pickProFor, { name: setup.name })}</p>
          <ProList selected="" fromStrung onPick={(p) => (setLastPro(p.id), setParams({ pro: p.id }))} />
        </Card>
      ) : (
        <SetupVsPro setup={setup} pro={pro} onOther={() => setParams({})} />
      )}
    </>
  )
}

function SetupVsPro({ setup, pro, onOther }: { setup: Setup; pro: ProTarget; onOther: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const r = useRacket(setup.racketId)
  const stock = useRacket(pro.baseRacketId)
  // The same basis: the setup with its strings on.
  const strungSetup = useMemo(() => ({ ...setup, accessories: { ...setup.accessories, strings: true } }), [setup])
  const computed = useComputed(strungSetup, r)
  if (!r || !computed) return null

  const p = withStrings(pro, pro, pro.strung, true)
  const proSpecs: Specs | undefined = stock && {
    ...compute({ spec: stock, ...defaultConfig(stock.id), masses }).result,
    weightG: p.weightG,
    balanceCm: p.balanceCm,
    swingweight: p.swingweight,
    recoilWeight: recoilWeight(p.swingweight, p.weightG, p.balanceCm),
    ptsHL: ptsHeadLight(pro.lengthCm, p.balanceCm),
    twistweight: undefined,
    twistweightEstimated: true,
  }
  const b: CompareSide = {
    id: `pro-${pro.id}`,
    title: pro.player,
    racket: pro.racket,
    strings: pro.strings && [pro.strings.name, pro.strings.tension].filter(Boolean).join(' · '),
    about: <ProAbout pro={pro} />,
    specs: { weightG: p.weightG, balanceCm: p.balanceCm, swingweight: p.swingweight },
    stringName: pro.strings?.name,
    tensionText: pro.strings?.tension,
    feel: stock && proSpecs ? racketFeel(stock, proSpecs) : undefined,
    feelEstimated: !!stock,
  }
  // Only goes there: Igualar counts the plan, by the same rule as any other.
  const howTo = () => {
    const handoff: MatchHandoff = { from: `setup:${setup.id}`, pro: pro.id, run: true }
    nav('/match', { state: handoff })
  }

  return (
    <CompareView
      a={setupSide(strungSetup, r, computed.result, t, lang)}
      b={b}
      below={
        <div className="space-y-3">
          <p className="text-sm text-muted">{t.compare.strungBasis}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={TargetIcon} onClick={howTo}>
              {t.compare.howTo}
            </Button>
            <Button variant="ghost" onClick={onOther}>
              {t.compare.otherPro}
            </Button>
          </div>
          <p className="text-xs text-muted">{t.compare.howToHint}</p>
          <p className="text-xs text-muted">{t.match.proDisclaimer}</p>
        </div>
      }
    />
  )
}

/** Under the pro's name: measured or reported, the source with its date,
 *  and the conversion when the source measured the bare frame. */
function ProAbout({ pro }: { pro: ProTarget }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  return (
    <span className="mt-1 block space-y-1 text-xs font-normal">
      <Badge tone={pro.evidence === 'measured' ? 'accent' : 'neutral'}>{t.match.evidence[pro.evidence]}</Badge>
      <a href={pro.url} target="_blank" rel="noreferrer" className="block underline underline-offset-2 wrap-anywhere">
        {fmt(t.match.proSource, { source: pro.source, date: monthYear(pro.date, lang) })}
      </a>
      {!pro.strung && <span className="block font-medium">{t.compare.convertedStrung}</span>}
    </span>
  )
}
