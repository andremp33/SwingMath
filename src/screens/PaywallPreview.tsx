import { useEffect, useState, type ReactNode } from 'react'
import { useAllRackets, useOwned, useSessions, useStringings } from '../data/hooks'
import { PRO_TARGETS, withStrings } from '../data/pros'
import { useStore } from '../data/store'
import { latestMeasurement } from '../domain/fleet'
import { hoursOn, type OwnedRacket } from '../domain/journal'
import { geometry } from '../domain/physics'
import { nearestTarget, racketPreview, type RacketPreview } from '../domain/preview'
import type { Racket } from '../domain/types'
import { fmt, useT } from '../i18n'
import type { PaywallReason } from '../lib/paywall'
import { fmtNum } from '../lib/format'
import { LEAD_MAX, StripDiagram } from '../ui/lead'
import { FleetTeaser } from './Fleet'
import { ReportTeaser } from './JournalReport'

/**
 * The top of the paywall: the player's own things when there are some.
 * Their racket and the strips of lead to a pro's; or, from the journal,
 * the real number from their strings; or, from the fleet, their rackets
 * with the lights blurred. Without a racket of theirs, the title by reason.
 */
export function PaywallTop({ reason }: { reason: PaywallReason }) {
  const owned = useOwned()
  const rackets = useAllRackets()
  const stringings = useStringings()
  const sessions = useSessions()
  const lastProId = useStore((s) => s.lastProId)
  const mine = owned?.find((o) => !o.retired)
  const frame = mine && rackets.find((r) => r.id === mine.racketId)
  if (!mine || !frame || !stringings || !sessions) return <ReasonHeader reason={reason} />

  if (reason === 'journal') {
    // The latest strings that were played.
    const played = [...stringings].sort((a, b) => b.date - a.date).find((st) => hoursOn(st.id, sessions) > 0)
    if (played) return <WithTeaser reason={reason} teaser={<ReportTeaser value={played} stringings={stringings} sessions={sessions} />} />
  }
  if (reason === 'fleet') {
    const measured = owned!.filter((o) => !o.retired && latestMeasurement(o)).map((o) => o.name)
    if (measured.length) return <WithTeaser reason={reason} teaser={<FleetTeaser names={measured.slice(0, 3)} />} />
  }
  const preview = previewFor(mine, frame, lastProId)
  return preview ? <RacketTeaser reason={reason} name={mine.name} frame={frame} {...preview} /> : <ReasonHeader reason={reason} />
}

/** A target a few strips away is a goal in reach; ten strips put people off. */
const FEW_STRIPS = 3

/** The player's racket as last measured (else its model's numbers), with
 *  strings, against the pro they opened last, else the nearest one lead
 *  reaches in a few strips, else the one it reaches in the fewest. */
function previewFor(o: OwnedRacket, frame: Racket, lastProId: string | null) {
  const m = latestMeasurement(o)
  const [specs, strung] = m ? [m, m.strung] : frame.strung ? [frame.strung, true] : [frame, false]
  const me = withStrings(frame, { weightG: specs.weightG, balanceCm: specs.balanceCm, swingweight: specs.swingweight }, strung, true)
  const base = { lengthCm: frame.lengthCm, headSizeSqIn: frame.headSizeSqIn, ...me }
  const targets = PRO_TARGETS.map((pro) => ({ id: pro.id, pro, specs: withStrings(pro, pro, pro.strung, true) }))
  const last = targets.find((x) => x.id === lastProId)
  const lastPreview = last && racketPreview(base, last.specs, LEAD_MAX)
  if (last && lastPreview?.strips.length) return { ...lastPreview, pro: last.pro }
  const reachable = targets.flatMap((x) => {
    const preview = racketPreview(base, x.specs, LEAD_MAX)
    return preview?.strips.length ? [{ ...x, preview }] : []
  })
  const near = nearestTarget(me, reachable.filter((x) => x.preview.strips.length <= FEW_STRIPS)) ?? [...reachable].sort((a, b) => a.preview.strips.length - b.preview.strips.length)[0]
  return near ? { ...near.preview, pro: near.pro } : null
}

/** One more strip at a time, the swingweight climbing with them; all at
 *  once for whoever asks for less motion. */
function useStripsShown(n: number) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(still ? n : 0)
  useEffect(() => {
    if (still || shown >= n) return
    const id = setTimeout(() => setShown(shown + 1), shown === 0 ? 400 : 220)
    return () => clearTimeout(id)
  }, [still, shown, n])
  return still ? n : Math.min(shown, n)
}

function RacketTeaser({
  reason,
  name,
  frame,
  strips,
  fromSw,
  toSw,
  pro,
}: RacketPreview & { reason: PaywallReason; name: string; frame: Racket; pro: (typeof PRO_TARGETS)[number] }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const shown = useStripsShown(strips.length)
  const n = strips.length
  // The tour, not the player: a name stays out of a screen that sells.
  const title = n === 1 ? t.paywall.previewTitleOne : t.paywall.previewTitle
  const sw = fromSw + ((toSw - fromSw) * shown) / n
  const sub = reason === 'profile' ? '' : t.paywall.subs[reason]
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight" data-testid="preview-title">
          {fmt(title, { racket: name, n, tour: pro.tour })}
        </h3>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex items-center gap-4 rounded-lg bg-surface-2 p-4">
        <div className="w-20 shrink-0">
          <StripDiagram geometry={geometry(frame.lengthCm, frame.headSizeSqIn)} pattern={frame.pattern} strips={strips} shown={shown} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="num text-2xl font-bold" data-testid="preview-sw" data-done={shown === n || undefined}>
            {fmt(t.paywall.previewSw, { sw: fmtNum(sw, 0, lang) })}
          </p>
          <p className="text-sm text-muted">{t.paywall.previewHint}</p>
        </div>
      </div>
    </div>
  )
}

function WithTeaser({ reason, teaser }: { reason: PaywallReason; teaser: ReactNode }) {
  return (
    <div className="space-y-3">
      <ReasonHeader reason={reason} />
      {teaser}
    </div>
  )
}

/** What opened the paywall, as its title. */
function ReasonHeader({ reason }: { reason: PaywallReason }) {
  const t = useT()
  if (reason === 'profile') return null
  const sub = t.paywall.subs[reason]
  return (
    <div>
      <h3 className="text-lg font-semibold tracking-tight">{t.paywall.titles[reason]}</h3>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  )
}
