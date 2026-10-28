/**
 * The free Pro that versions before 28 October 2026 gave when the first
 * launch's walkthrough ended. No new player gets it (Pro is tried through
 * the store's free trial); those who have it keep it until its date, and
 * then hear once that it ended. No payment and no store: the player's data
 * stays where it is.
 */

export const freeProActive = (until: number | null | undefined, now = Date.now()) => until != null && now < until

/** Over, and the player not told yet. */
export const freeProJustEnded = (until: number | null | undefined, told: boolean, now = Date.now()) => until != null && now >= until && !told

/** What the end-of-free-Pro paywall opens on: the journal's report when the
 *  player has played, else their fleet when they measured, else their racket. */
export function freeProEndReason({ played, measured }: { played: boolean; measured: boolean }): 'journal' | 'fleet' | 'profile' {
  return played ? 'journal' : measured ? 'fleet' : 'profile'
}
