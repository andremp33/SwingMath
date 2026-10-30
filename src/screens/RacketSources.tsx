import type { Racket } from '../domain/types'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum } from '../lib/format'

const link = 'font-semibold text-accent-text underline underline-offset-2'

/** Where a stock racket's numbers come from: the maker's page, and what we
 *  estimate from it. */
export function RacketSources({ racket }: { racket: Racket }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const o = racket.official
  if (!o) return null
  const from = racket.specFrom
  const fromMaker = from ? (['weight', 'balance', 'swingweight'] as const).filter((k) => from[k] === 'official').map((k) => t.sources.fields[k]) : []
  return (
    <div className="space-y-4">
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

      {from?.swingweight === 'estimated' && (
        <section className="space-y-1">
          <h3 className="font-semibold">{t.sources.estimatedTitle}</h3>
          <p className="num">SW {fmtNum(racket.swingweight, 0, lang)}</p>
          <p className="text-muted">{fmt(t.sources.estimatedHow, { brand: racket.brand })}</p>
        </section>
      )}
      <p className="text-muted">{t.sources.unitsVary}</p>
    </div>
  )
}
