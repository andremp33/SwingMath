import { ExternalLink, Play } from 'lucide-react'
import { useState } from 'react'
import { PRO_TARGETS, type ProTarget } from '../data/pros'
import { isPro, useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { fmtNum, fold, LOCALE } from '../lib/format'
import { Badge, Button, cx, TextField } from './basics'
import { useUnits } from '../lib/units'

/** "junho de 2023" from "2023-06". */
export const monthYear = (ym: string, lang: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(LOCALE[lang] ?? 'en-GB', { month: 'long', year: 'numeric' })

/** Who published a pro's numbers, without the detail: "Tennisnerd" from
 *  "Tennisnerd (Jonas Eriksson), ATP Vienna". */
const shortSource = (s: string) => s.split(/[(,]/)[0].trim()

/** A pro's name and racquet, searched without accents or case. */
const proMatches = (p: ProTarget, q: string) => fold(`${p.player} ${p.racket}`).includes(fold(q.trim()))

/** A pro as a row: the player, measured or reported, the racquet and its
 *  numbers. The numbers are Pro: everyone else sees whose racquet it is. */
export function ProRow({ p }: { p: ProTarget }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const pro = useStore(isPro)
  const u = useUnits()
  return (
    <>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{p.player}</span>
          <Badge tone={p.evidence === 'measured' ? 'accent' : 'neutral'}>{t.match.evidence[p.evidence]}</Badge>
        </span>
        <span className="block truncate text-muted">{p.racket}</span>
        <span className="block truncate text-xs text-muted">{fmt(t.match.proBy, { source: shortSource(p.source) })}</span>
      </span>
      {pro ? (
        <span className="num shrink-0 text-right text-xs text-muted">
          {u.weight(p.weightG)} {u.weightUnit} · SW {fmtNum(p.swingweight, 0, lang)}
          <span className="block">{p.strung ? t.match.strungShort : t.match.unstrungShort}</span>
        </span>
      ) : (
        <Badge tone="pro">Pro</Badge>
      )}
    </>
  )
}

/** The picked pro: the note, where the numbers come from, the strings. */
export function ProDetails({ p, fromStrung, onStock }: { p: ProTarget; fromStrung: boolean; onStock?: (p: ProTarget) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const notes = t.match.pros as Record<string, string>
  return (
    <div className="space-y-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
      {notes[p.id] && <p>{notes[p.id]}</p>}
      <p className="text-muted">
        <span className="font-medium text-text">{t.match.evidence[p.evidence]}:</span> {t.match.evidenceHint[p.evidence]}
      </p>
      <p>
        <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
          {fmt(t.match.proSource, { source: p.source, date: monthYear(p.date, lang) })} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </p>
      {p.strings && <p className="num">{fmt(t.match.proStrings, { s: [p.strings.name, p.strings.tension].filter(Boolean).join(' · ') })}</p>}
      {p.strung !== fromStrung && (
        <p className="font-medium">
          {fmt(t.match.converted, { from: p.strung ? t.match.strungShort : t.match.unstrungShort, to: fromStrung ? t.match.strungShort : t.match.unstrungShort })}
        </p>
      )}
      {p.baseRacketId && onStock && (
        <Button size="sm" icon={Play} onClick={() => onStock(p)}>
          {t.match.fromStock}
        </Button>
      )}
      <p className="text-xs text-muted">{t.match.proDisclaimer}</p>
    </div>
  )
}

/**
 * Pro targets: searchable, ATP and WTA apart. Each says whether it was
 * measured or reported, by whom and when, with the link.
 */
export function ProList({ selected, fromStrung, onPick, onStock }: { selected: string; fromStrung: boolean; onPick: (p: ProTarget) => void; onStock?: (p: ProTarget) => void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const picked = PRO_TARGETS.find((p) => p.id === selected)
  const shown = PRO_TARGETS.filter((p) => proMatches(p, q))
  return (
    <div className="space-y-3">
      <TextField label={t.match.proSearch} value={q} onChange={setQ} />
      {shown.length === 0 && <p className="text-sm text-muted">{t.match.noPros}</p>}
      {(['ATP', 'WTA'] as const).map((tour) => {
        const list = shown.filter((p) => p.tour === tour)
        if (!list.length) return null
        return (
          <div key={tour}>
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted">{tour}</h3>
            <div role="radiogroup" aria-label={`${t.match.kindPro} ${tour}`} className="divide-y divide-border rounded-md border border-border">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === p.id}
                  onClick={() => onPick(p)}
                  className={cx('flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors', selected === p.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                >
                  <ProRow p={p} />
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {picked ? <ProDetails p={picked} fromStrung={fromStrung} onStock={onStock} /> : <p className="text-xs text-muted">{t.match.proDisclaimer}</p>}
    </div>
  )
}
