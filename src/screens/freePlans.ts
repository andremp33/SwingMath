import { planAccess, setupRoom, type PlanAccess } from '../domain/freePlans'
import { useSetups } from '../data/hooks'
import { isPro, useStore } from '../data/store'

/**
 * The solver's free plans (domain/freePlans.ts): whether a plan shows whole,
 * and, once it has a result, taking one of the free ones if it is new.
 * Nothing is spent before the solver has given a result.
 */
export function useFreePlans() {
  const pro = useStore(isPro)
  const plans = useStore((s) => s.freePlans)
  const add = useStore((s) => s.addFreePlan)
  return {
    access: (key: string): PlanAccess => planAccess(plans, key, pro),
    /** After a result: the plan is now one of the player's free ones. */
    record: (key: string, a: PlanAccess) => a.spends && add(key),
  }
}

/** Room for one more saved setup (domain/freePlans.ts); unknown while the
 *  setups load, and then there is room. */
export function useSetupRoom() {
  const pro = useStore(isPro)
  const setups = useSetups()
  return setupRoom(setups?.length ?? 0, pro)
}
