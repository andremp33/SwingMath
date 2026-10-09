import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_ACCESSORY_MASSES,
  emptyLead,
  type AccessoryMasses,
  type ExtraLead,
  type Position,
  type SetupConfig,
} from '../domain/types'
import { DEFAULT_STRINGBED } from '../domain/strings'
import type { Lang } from '../i18n'
import { STOCK_RACKETS } from './rackets'

export type Theme = 'system' | 'dark' | 'light'

export interface License {
  provider: 'lemonsqueezy' | 'store' | 'dev'
  key?: string
  instanceId?: string
  activatedAt: number
  /** Last time the store confirmed the subscription. */
  checkedAt?: number
  /** 'ended': the subscription ended; 'offline': not confirmed for too long. */
  status?: 'active' | 'ended' | 'offline'
  /** When the current period ends, as Lemon Squeezy reports it. */
  expiresAt?: string | null
}

export const defaultConfig = (racketId = STOCK_RACKETS[0].id): SetupConfig => ({
  racketId,
  baseMode: 'reference',
  measured: {},
  accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
  leadG: emptyLead(),
  extra: [],
  grip: { base: 2, extraOvergrips: 0, sleeves: 0 },
  strings: DEFAULT_STRINGBED,
})

interface State {
  lang: Lang
  theme: Theme
  masses: AccessoryMasses
  /** Mass of 10 cm of the player's lead tape, to show how much to cut. */
  tapeGPer10cm?: number
  license: License | null
  /** The calculator's working setup, kept across reloads. */
  config: SetupConfig
  /** Saved setup the calculator was opened from, if any. */
  loadedSetupId: string | null
  /** Setup ids picked for comparison. */
  compare: string[]
  /** Pro tool runs used before buying (try before you pay). */
  freeRunsUsed: number
  /** Stringings we already sent a restring reminder for. */
  reminded: string[]

  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  setMasses: (m: Partial<AccessoryMasses>) => void
  setTape: (g: number | undefined) => void
  setLicense: (l: License | null) => void
  setConfig: (c: Partial<SetupConfig>) => void
  setLead: (p: Position, g: number) => void
  addExtra: (e: ExtraLead) => void
  updateExtra: (id: string, e: Partial<ExtraLead>) => void
  removeExtra: (id: string) => void
  loadConfig: (c: SetupConfig, setupId: string | null) => void
  resetConfig: () => void
  toggleCompare: (id: string) => void
  clearCompare: () => void
  spendFreeRun: () => void
  markReminded: (ids: string[]) => void
}

const browserLang = (): Lang => {
  const l = typeof navigator === 'undefined' ? '' : navigator.language?.toLowerCase() ?? ''
  return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en'
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      lang: browserLang(),
      theme: 'system',
      masses: DEFAULT_ACCESSORY_MASSES,
      license: null,
      config: defaultConfig(),
      loadedSetupId: null,
      compare: [],
      freeRunsUsed: 0,
      reminded: [],

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setMasses: (m) => set((s) => ({ masses: { ...s.masses, ...m } })),
      setTape: (tapeGPer10cm) => set({ tapeGPer10cm }),
      setLicense: (license) => set({ license }),
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      setLead: (p, g) => set((s) => ({ config: { ...s.config, leadG: { ...s.config.leadG, [p]: g } } })),
      addExtra: (e) => set((s) => ({ config: { ...s.config, extra: [...(s.config.extra ?? []), e].slice(0, 12) } })),
      updateExtra: (id, e) =>
        set((s) => ({ config: { ...s.config, extra: (s.config.extra ?? []).map((x) => (x.id === id ? { ...x, ...e } : x)) } })),
      removeExtra: (id) => set((s) => ({ config: { ...s.config, extra: (s.config.extra ?? []).filter((x) => x.id !== id) } })),
      loadConfig: (config, loadedSetupId) => set({ config: structuredClone(config), loadedSetupId }),
      resetConfig: () =>
        set((s) => ({ config: { ...defaultConfig(s.config.racketId) }, loadedSetupId: null })),
      toggleCompare: (id) =>
        set((s) => ({
          compare: s.compare.includes(id) ? s.compare.filter((x) => x !== id) : [...s.compare, id].slice(-2),
        })),
      clearCompare: () => set({ compare: [] }),
      spendFreeRun: () => set((s) => ({ freeRunsUsed: s.freeRunsUsed + 1 })),
      markReminded: (ids) => set((s) => ({ reminded: [...new Set([...s.reminded, ...ids])].slice(-200) })),
    }),
    {
      name: 'swingmath',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // v2: the stock library was replaced by verified frames with new ids.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<State>
        const id = s.config?.racketId
        const goneStock = id?.startsWith('stock-') && !STOCK_RACKETS.some((r) => r.id === id)
        if (version < 2 && s.config && goneStock) {
          s.config = { ...s.config, racketId: STOCK_RACKETS[0].id }
          s.loadedSetupId = null
        }
        // v3: a sleeve mass was added; keep the user's own masses.
        if (version < 3 && s.masses) s.masses = { ...DEFAULT_ACCESSORY_MASSES, ...s.masses }
        return s as State
      },
    },
  ),
)

export const isPro = (s: { license: License | null }) => s.license !== null && (s.license.status ?? 'active') === 'active'
export const FREE_SETUP_LIMIT = 3
export const FREE_PRO_RUNS = 3
/** Sessions the free journal shows. */
export const FREE_SESSIONS = 10
