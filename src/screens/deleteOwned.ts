import { deleteOwned, restoreOwned } from '../data/db'
import type { OwnedRacket } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { useToast } from '../ui/overlay'

/** Deletes one of the player's rackets at once, saying what went with it
 *  (its stringings and measurements; the sessions stay), with an undo. */
export function useDeleteOwned() {
  const t = useT()
  const toast = useToast()
  return async (o: OwnedRacket) => {
    const gone = await deleteOwned(o.id)
    if (!gone) return
    const st = gone.stringings.length
    const ms = gone.owned.measurements?.length ?? 0
    const what = [
      st ? (st === 1 ? t.journal.stringingsOne : fmt(t.journal.stringingsN, { n: st })) : '',
      ms ? (ms === 1 ? t.journal.measurementsOne : fmt(t.journal.measurementsN, { n: ms })) : '',
    ]
      .filter(Boolean)
      .join(t.journal.and)
    toast(fmt(what ? t.journal.racketDeletedWith : t.journal.racketDeleted, { name: gone.owned.name, what }), {
      label: t.common.undo,
      run: () => void restoreOwned(gone),
    })
  }
}

