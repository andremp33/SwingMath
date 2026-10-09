import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { compute } from '../domain/physics'
import type { Racket, SetupConfig } from '../domain/types'
import { db, findRacket } from './db'
import { STOCK_RACKETS } from './rackets'
import { useStore } from './store'

export function useCustomRackets(): Racket[] | undefined {
  return useLiveQuery(() => db.rackets.orderBy('updatedAt').reverse().toArray(), [])
}

/** Stock and custom rackets together, custom first. */
export function useAllRackets(): Racket[] {
  const custom = useCustomRackets()
  return useMemo(() => [...(custom ?? []), ...STOCK_RACKETS], [custom])
}

export function useRacket(id: string | undefined): Racket | undefined {
  const custom = useCustomRackets()
  return useMemo(() => findRacket(id, custom), [id, custom])
}

export function useSetups() {
  return useLiveQuery(() => db.setups.orderBy('updatedAt').reverse().toArray(), [])
}

/** Specs for a setup config, or undefined while its racket is unknown. */
export function useComputed(config: SetupConfig | undefined, racket: Racket | undefined) {
  const masses = useStore((s) => s.masses)
  return useMemo(() => {
    if (!config || !racket) return undefined
    return compute({ spec: racket, ...config, masses })
  }, [config, racket, masses])
}

export function useStringings() {
  return useLiveQuery(() => db.stringings.orderBy('date').reverse().toArray(), [])
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
}
