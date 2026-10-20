import { useEffect } from 'react'
import { useOwned, useSessions } from '../data/hooks'
import { isPro, useStore } from '../data/store'
import { latestMeasurement } from '../domain/fleet'
import { freeProEndReason, freeProJustEnded } from '../domain/trial'
import { usePaywall } from './Pro'

/**
 * The first launch after the free Pro ends: the paywall, once, on the
 * player's own report or fleet. It counts as the session's paywall nobody
 * asked for. Nothing of theirs is hidden; only the Pro views lock again.
 */
export function useFreeProEnd() {
  const until = useStore((s) => s.freeProUntil)
  const told = useStore((s) => s.freeProEndTold)
  const markTold = useStore((s) => s.markFreeProEndTold)
  // Bought Pro meanwhile: nothing to say.
  const paid = useStore((s) => isPro({ ...s, freeProUntil: null }))
  const paywall = usePaywall()
  const owned = useOwned()
  const sessions = useSessions()
  const ended = freeProJustEnded(until, told)
  useEffect(() => {
    if (!ended || !owned || !sessions) return
    markTold()
    if (!paid) paywall(freeProEndReason({ played: sessions.some((s) => s.stringingId), measured: owned.some((o) => !o.retired && latestMeasurement(o)) }))
  }, [ended, owned, sessions, paid, markTold, paywall])
}
