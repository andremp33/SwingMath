import { CircleAlert, CircleCheck } from 'lucide-react'
import type { Racket } from '../domain/types'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum } from '../lib/format'

const link = 'font-semibold text-accent-text underline underline-offset-2'

/** Where a stock racket's numbers come from, and whether they agree. */
export function RacketSources({ racket }: { racket: Racket }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const o = racket.official
  const m = racket.measured
  const from = racket.specFrom
  const fromMaker = from ? (['weight', 'balance', 'swingweight'] as const).filter((k) => from[k] === 'official').map((k) => t.sources.fields[k]) : []
  return (
    <div className="space-y-4">
      {o ? (
        <section className="space-y-1">
          <h3 className="font-semibold">{fmt(t.sources.official, { brand: racket.brand })}</h3>
          <p className="num">
            {fmtNum(o.weightG, 0, lang)} g
            {o.balanceMm !== undefined && <> · {fmtNum(o.balanceMm, 0, lang)} mm</>}
            {o.swingweight !== undefined && <> · SW {fmtNum(o.swingweight, 0, lang)}</>}
            {o.ra !== undefined && <> · RA {o.ra}</>}
          </p>
          <p className="text-muted">{fmt(t.sources.usedFor, { what: fromMaker.join(', ') })}</p>
          <a href={o.href} target="_blank" rel="noopener noreferrer" className={link}>
            {o.archived ? t.sources.archivedPage : t.sources.officialPage}
          </a>
        </section>
      ) : (
        <p>{t.sources.noOfficial}</p>
      )}

      {m && (
        <section className="space-y-1">
          <h3 className="font-semibold">{t.sources.measuredTitle}</h3>
          <p className="num">
            {fmtNum(m.weightG, 1, lang)} g · {fmtNum(m.balanceCm * 10, 1, lang)} mm · SW {fmtNum(m.swingweight, 1, lang)}
          </p>
          <p className="text-muted">{t.sources.measuredHow}</p>
          {racket.approxWeight && <p className="text-muted">{t.calc.approxNote}</p>}
        </section>
      )}

      {racket.agrees !== undefined && (
        <p className="flex gap-2">
          {racket.agrees ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          )}
          {racket.agrees ? t.sources.agrees : t.sources.differs}
        </p>
      )}
      <p className="text-muted">{t.sources.unitsVary}</p>
    </div>
  )
}
