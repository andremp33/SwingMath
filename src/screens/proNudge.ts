import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useOwned, useSessions } from '../data/hooks'
import { isPro, useStore } from '../data/store'
import { latestMeasurement } from '../domain/fleet'
import { freeProEndReason, freeProJustEnded } from '../domain/trial'
import { nudgeDue } from '../lib/paywall'
import { usePaywall } from './Pro'

/**
 * Pro, brought up again from time to time: a launch a week after the
 * paywall was last open opens it on the player's own report, fleet or
 * racket, as at the free Pro's end. It is the session's paywall nobody
 * asked for, so never two in one session; not for those with Pro, and not
 * when the app opened on a restring reminder, which has its own sheet.
 */
export function useProNudge() {
  const lastAt = useStore((s) => s.proNudgeAt)
  const start = useStore((s) => s.setProNudgeAt)
  const pro = useStore(isPro)
  const freeProEnding = useStore((s) => freeProJustEnded(s.freeProUntil, s.freeProEndTold))
  const fromReminder = new URLSearchParams(useLocation().search).has('lembrete')
  const paywall = usePaywall()
  const owned = useOwned()
  const sessions = useSessions()
  useEffect(() => {
    // The first launch starts the clock.
    if (lastAt === null) return start(Date.now())
    if (pro || freeProEnding || fromReminder || !nudgeDue(lastAt) || !owned || !sessions) return
    paywall(freeProEndReason({ played: sessions.some((s) => s.stringingId), measured: owned.some((o) => !o.retired && latestMeasurement(o)) }))
    // Once per launch: after this, only the next launch looks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!owned && !!sessions])
}
