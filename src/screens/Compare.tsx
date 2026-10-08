import { ArrowLeft, GitCompareArrows } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { feel } from '../domain/feel'
import { POSITIONS, STROKES, type Setup } from '../domain/types'
import { useComputed, useRacket, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { extraLabel, fmtNum, fmtSigned, racketLabel } from '../lib/format'
import { Button, Card, CardTitle, cx, EmptyState, PageTitle } from '../ui/basics'
import { FeelRings } from '../ui/specs'

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
        <CompareView a={a} b={b} />
      )}
    </>
  )
}

function CompareView({ a, b }: { a: Setup; b: Setup }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const ra = useRacket(a.racketId)
  const rb = useRacket(b.racketId)
  const ca = useComputed(a, ra)
  const cb = useComputed(b, rb)
  // Custom positions of either setup, matched by their name ("11h e 1h").
  const extraRows = (() => {
    const m = new Map<string, [number, number]>()
    for (const e of a.extra ?? []) {
      const k = extraLabel(e, t, lang)
      m.set(k, [(m.get(k)?.[0] ?? 0) + e.grams, m.get(k)?.[1] ?? 0])
    }
    for (const e of b.extra ?? []) {
      const k = extraLabel(e, t, lang)
      m.set(k, [m.get(k)?.[0] ?? 0, (m.get(k)?.[1] ?? 0) + e.grams])
    }
    return [...m].map(([k, [x, y]]) => [k, x, y] as const)
  })()
  if (!ra || !rb || !ca || !cb) return null
  const A = ca.result
  const B = cb.result

  const rows: [string, number, number, number, string?][] = [
    [t.spec.weight, A.weightG, B.weightG, 1, 'g'],
    [t.spec.balance, A.balanceCm * 10, B.balanceCm * 10, 1, 'mm'],
    [t.spec.swingweight, A.swingweight, B.swingweight, 1],
    [t.spec.twistweight, A.twistweight ?? 0, B.twistweight ?? 0, 2],
    [t.spec.recoil, A.recoilWeight, B.recoilWeight, 1],
    [t.spec.sweetSpot, A.sweetSpotCm, B.sweetSpotCm, 1, 'cm'],
  ]

  return (
    <div className="space-y-4">
      <Card>
        <table className="num w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-3 font-normal text-muted" />
              <th className="pb-3 text-right align-bottom">
                <span className="flex items-center justify-end gap-1.5 font-bold">
                  <span className="size-2.5 rounded-full bg-bar" /> {a.name}
                </span>
                <span className="hidden text-xs font-normal text-muted sm:block">{racketLabel(ra)}</span>
              </th>
              <th className="pb-3 text-right align-bottom">
                <span className="flex items-center justify-end gap-1.5 font-bold">
                  <span className="size-2.5 rounded-full bg-muted" /> {b.name}
                </span>
                <span className="hidden text-xs font-normal text-muted sm:block">{racketLabel(rb)}</span>
              </th>
              <th className="pb-3 pl-2 text-right text-xs font-normal text-muted"><abbr title="B − A">Δ</abbr></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map(([label, va, vb, d, unit]) => {
              const diff = Math.round((vb - va) * 10 ** d) / 10 ** d
              return (
                <tr key={label}>
                  <th scope="row" className="py-2 text-left font-normal text-muted">
                    {label}
                  </th>
                  <td className="py-2 text-right font-semibold">
                    {fmtNum(va, d, lang)} {unit}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {fmtNum(vb, d, lang)} {unit}
                  </td>
                  <td className={cx('py-2 text-right text-xs font-semibold', diff === 0 ? 'text-muted' : diff > 0 ? 'text-accent-text' : 'text-warning')}>
                    {diff === 0 ? '=' : fmtSigned(vb - va, d, lang)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t.calc.feel}</CardTitle>
          <FeelRings feel={feel(A, ra.headSizeSqIn, ra.ra)} compare={feel(B, rb.headSizeSqIn, rb.ra)} labels={[a.name, b.name]} />
        </Card>
        <Card>
          <CardTitle>{t.setups.ratings}</CardTitle>
          <dl className="space-y-2 text-sm">
            {STROKES.map((k) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{t.stroke[k]}</dt>
                <dd className="num font-semibold">
                  {a.ratings[k] ?? '—'} <span className="text-muted">/</span> {b.ratings[k] ?? '—'}
                </dd>
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
                  {fmtNum(a.leadG[p], 1, lang)} <span className="text-muted">/</span> {fmtNum(b.leadG[p], 1, lang)} g
                </dd>
              </div>
            ))}
            {extraRows.map(([label, ga, gb]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-muted">{label}</dt>
                <dd className="num font-semibold">
                  {fmtNum(ga, 1, lang)} <span className="text-muted">/</span> {fmtNum(gb, 1, lang)} g
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}
