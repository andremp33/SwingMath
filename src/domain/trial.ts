/**
 * Pro free until the next restring: given once, when the first launch's
 * walkthrough ends. No payment and no store: it ends on its own, and the
 * player's data stays where it is.
 */

const DAY = 86_400_000
export const FREE_PRO_MIN_DAYS = 14
export const FREE_PRO_MAX_DAYS = 30

/** Until the strings' predicted restring, kept between 14 and 30 days;
 *  without strings yet, 14 days. */
export function freeProEnd(now: number, restringAt?: number): number {
  const lo = now + FREE_PRO_MIN_DAYS * DAY
  const hi = now + FREE_PRO_MAX_DAYS * DAY
  return restringAt === undefined ? lo : Math.min(hi, Math.max(lo, restringAt))
}

export const freeProActive = (until: number | null | undefined, now = Date.now()) => until != null && now < until

/** Over, and the player not told yet. */
export const freeProJustEnded = (until: number | null | undefined, told: boolean, now = Date.now()) => until != null && now >= until && !told

/** What the end-of-free-Pro paywall opens on: the journal's report when the
 *  player has played, else their fleet when they measured, else their racket. */
export function freeProEndReason({ played, measured }: { played: boolean; measured: boolean }): 'journal' | 'fleet' | 'profile' {
  return played ? 'journal' : measured ? 'fleet' : 'profile'
}
