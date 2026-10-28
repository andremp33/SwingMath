import { Ban, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { findRacket } from '../data/db'
import { useCustomRackets } from '../data/hooks'
import { useStore } from '../data/store'
import type { SetupConfig } from '../domain/types'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum, leadParts } from '../lib/format'
import { isModerator, moderate, moderationQueue, reasonCounts, type Decision, type QueueItem } from '../lib/moderation'
import { useUnits } from '../lib/units'
import { Badge, Button, Card, PageTitle } from '../ui/basics'
import { useToast } from '../ui/overlay'

/**
 * The moderation queue: hidden recipes with reports nobody reviewed yet.
 * Each is shown again, kept hidden, or kept hidden with its author blocked.
 * Only moderators get here with anything to see; the server checks.
 */
export function Moderation() {
  const t = useT()
  const account = useStore((s) => s.account)
  // undefined while asking; null: not a moderator.
  const [queue, setQueue] = useState<QueueItem[] | null>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    if (account)
      isModerator()
        .then((yes) => (yes ? moderationQueue() : null))
        .then((q) => alive && setQueue(q))
        .catch(() => alive && setQueue(null))
    return () => {
      alive = false
    }
  }, [account, version])

  return (
    <>
      <PageTitle subtitle={queue ? fmt(t.moderation.toReview, { n: queue.length }) : undefined}>{t.moderation.title}</PageTitle>
      {!account || queue === null ? (
        <p className="text-sm text-muted">{t.moderation.onlyModerators}</p>
      ) : queue === undefined ? null : queue.length === 0 ? (
        <p className="text-sm text-muted">{t.moderation.empty}</p>
      ) : (
        <ul className="space-y-4">
          {queue.map((q) => (
            <li key={q.id}>
              <QueueCard item={q} onDone={() => setVersion((v) => v + 1)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function QueueCard({ item: q, onDone }: { item: QueueItem; onDone: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const u = useUnits()
  const toast = useToast()
  const custom = useCustomRackets()
  const [busy, setBusy] = useState<Decision | null>(null)
  // Blocking an author is asked twice.
  const [blocking, setBlocking] = useState(false)
  const frame = findRacket(q.racket_id, custom)
  const lead = leadParts(q.config as unknown as SetupConfig, t, lang)

  const decide = async (d: Decision) => {
    setBusy(d)
    try {
      await moderate(q.id, d)
      toast(t.moderation.done[d])
      onDone()
    } catch {
      toast(t.community.error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card label={q.name} className="space-y-3">
      <div className="space-y-1 text-sm">
        <h2 className="font-medium">
          {q.name} <span className="font-normal text-muted">· {q.author || t.community.anon}</span>
        </h2>
        {frame && <p className="text-muted">{`${frame.brand} ${frame.model}${frame.year ? ` (${frame.year})` : ''}`}</p>}
        <p className="readout">{lead.length ? lead.join(' · ') : t.setups.noLead}</p>
        <p className="num text-muted">
          {u.weight(q.specs.weightG)} {u.weightUnit} · {u.balance(q.specs.balanceCm)} {u.balanceUnit} · SW {fmtNum(q.specs.swingweight, 0, lang)}
        </p>
      </div>
      <div className="space-y-1.5 text-sm">
        <p>{fmt(q.reports === 1 ? t.moderation.reportOne : t.moderation.reports, { n: q.reports, date: fmtDate(Date.parse(q.last_report), lang) })}</p>
        <p className="flex flex-wrap gap-1">
          {reasonCounts(q.reasons).map(([r, n]) => (
            <Badge key={r}>
              {(t.community.reasons as Record<string, string>)[r] ?? r} × {n}
            </Badge>
          ))}
          {q.copies > 0 && <span className="num text-xs text-muted">{fmt(t.community.copies, { n: q.copies })}</span>}
        </p>
        {q.author_blocked && <p className="text-danger">{t.moderation.authorBlocked}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Eye} loading={busy === 'show'} disabled={!!busy} onClick={() => decide('show')}>
          {t.moderation.show}
        </Button>
        <Button size="sm" variant="ghost" icon={EyeOff} loading={busy === 'keep'} disabled={!!busy} onClick={() => decide('keep')}>
          {t.moderation.keep}
        </Button>
        {!q.author_blocked && (
          <Button
            size="sm"
            variant={blocking ? 'primary' : 'ghost'}
            icon={Ban}
            loading={busy === 'block'}
            disabled={!!busy}
            onClick={() => (blocking ? decide('block') : setBlocking(true))}
            className={blocking ? undefined : 'text-danger'}
          >
            {blocking ? t.moderation.blockConfirm : t.moderation.block}
          </Button>
        )}
      </div>
    </Card>
  )
}
