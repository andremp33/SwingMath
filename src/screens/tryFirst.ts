import { FREE_PRO_RUNS, isPro, useStore } from '../data/store'
import { usePaywall } from './Pro'

/** Pro tools work a few times before buying, so people can try first. */
export function useTryFirst() {
  const pro = useStore(isPro)
  const used = useStore((s) => s.freeRunsUsed)
  const spend = useStore((s) => s.spendFreeRun)
  const paywall = usePaywall()
  return () => {
    if (pro) return true
    if (used >= FREE_PRO_RUNS) {
      paywall('solver')
      return false
    }
    spend()
    return true
  }
}
