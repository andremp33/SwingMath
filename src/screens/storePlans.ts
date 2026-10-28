import { useEffect, useState } from 'react'
import { isPro, useStore } from '../data/store'
import { IS_PREVIEW } from '../lib/platform'
import type { StorePlan } from '../lib/purchases'

/** The store's plans, asked for once per launch, and again after a
 *  purchase (who took the trial may not take it again). */
let plansOnce: Promise<StorePlan[]> | null = null
export function loadPlans(): Promise<StorePlan[]> {
  // The app's preview in a browser sells nothing.
  plansOnce ??= (IS_PREVIEW ? Promise.resolve<StorePlan[]>([]) : import('../lib/purchases').then((m) => m.storePlans())).catch(() => {
    plansOnce = null
    return []
  })
  return plansOnce
}

/** After a purchase: the next look asks the store again. */
export const forgetPlans = () => {
  plansOnce = null
}

/** Days of the store's free trial this player may still take; null without
 *  one (taken before, Pro already, or no store: the website and preview). */
export function useTrialDays(): number | null {
  const pro = useStore(isPro)
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => {
    if (pro) return
    let live = true
    void loadPlans().then((p) => live && setDays(Math.max(0, ...p.map((x) => x.trialDays ?? 0)) || null))
    return () => {
      live = false
    }
  }, [pro])
  return pro ? null : days
}
