import type { Goal, Level, Style } from '../lib/community'
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
import { PRO_BETA } from '../lib/entitlement'
import type { Lang } from '../i18n'
import { RENAMED, STOCK_RACKETS } from './rackets'
import { withPlan } from '../domain/freePlans'
import { freeProActive } from '../domain/trial'

export type Theme = 'system' | 'dark' | 'light'
/** The app's ground and accent: clay (the brand's), hard court or grass. */
export type Court = 'clay' | 'hard' | 'grass'

export interface License {
  /** 'store': App Store or Google Play, through RevenueCat; 'dev': development and tests. */
  provider: 'store' | 'dev'
  activatedAt: number
  /** Last time the store confirmed the subscription. */
  checkedAt?: number
  /** 'ended': the subscription ended. */
  status?: 'active' | 'ended'
  /** When the current period ends, as the store reports it. */
  expiresAt?: string | null
  /** Store subscriptions: renews at the end of the period (false: cancelled). */
  willRenew?: boolean
  /** Store subscriptions: still in the free trial. */
  trial?: boolean
  /** Bought once, for good: no period, nothing to manage. */
  lifetime?: boolean
}

export interface Account {
  userId: string
  email: string
}

/** The account's subscription, as the server last reported it. */
export interface AccountPro {
  status: string
  endsAt: string | null
  checkedAt: number
}

export interface SyncState {
  /** Account the cursor belongs to; another account starts over. */
  userId: string | null
  cursor: string | null
  lastAt?: number
  /** 'elsewhere': without Pro, another device has the sync. */
  error?: 'offline' | 'other' | 'elsewhere'
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

/** What the player tells us about their game. All optional. */
export interface Profile {
  /** Playing hours a week, for the restring date until sessions are logged. */
  hoursPerWeek?: number
  /** What they want to improve (up to 2): the calculator's goal advice and
   *  the community's default filter. */
  goals?: Goal[]
  /** Places their swingweight against what is usual (domain/goals.ts). */
  level?: Level
  style?: Style
}

/** The avatar's colours without a photo (index.css, --avatar-*). */
export const AVATAR_COLORS = ['clay', 'blue', 'green', 'violet', 'rose', 'ink'] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]

/** Who the player is, as the avatar shows them: on this device without an
 *  account, on the account with one (app/account.ts, syncMe). All optional. */
export interface Me {
  /** The name to show. */
  name?: string
  /** A square JPEG (lib/photo.ts), as a data URL. */
  photo?: string
  /** Without a photo: initials on this colour, or on the neutral tone. */
  color?: AvatarColor
  /** Last change (ms): the newer of this device and the account wins. */
  at?: number
  /** When the photo was set or removed (ms): a sync sends or fetches it
   *  only when this differs from the account's. */
  photoAt?: number
}

/** Grams and millimetres, or ounces and inches (as players in the US read them). */
export type UnitSystem = 'metric' | 'imperial'

interface State {
  lang: Lang
  theme: Theme
  court: Court
  units: UnitSystem
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
  /** Rackets shown on the racket map. */
  mapIds: string[]
  /** The solver's free plans used, by their key (domain/freePlans.ts). */
  freePlans: string[]
  /** The fleet's reference racket (#1) the player picked; none: the
   *  highest swingweight (domain/fleet.ts). */
  fleetRef: string | null
  /** The pro the player opened last (Compare, Igualar): the paywall's preview aims at them. */
  lastProId: string | null
  /** Pro free until then (ms), given once when the walkthrough ends
   *  (domain/trial.ts); null if never given. */
  freeProUntil: number | null
  /** The player was shown that the free Pro ended. */
  freeProEndTold: boolean
  /** Last time the paywall was open, asked or not (ms): Pro is brought up
   *  again a while after (lib/paywall.ts); null until the first launch. */
  proNudgeAt: number | null
  /** Stringings we already sent a restring reminder for. */
  reminded: string[]
  profile: Profile
  me: Me
  /** The first-launch walkthrough has been done or skipped (store apps). */
  onboarded: boolean
  /** Community authors the player chose not to see (their user ids). */
  hiddenAuthors: string[]
  /** String names the player used last, newest first (the name field's suggestions). */
  recentStrings: string[]
  account: Account | null
  accountPro: AccountPro | null
  sync: SyncState

  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  setCourt: (c: Court) => void
  setUnits: (u: UnitSystem) => void
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
  toggleMap: (id: string) => void
  clearCompare: () => void
  addFreePlan: (key: string) => void
  setFleetRef: (id: string | null) => void
  setLastPro: (id: string) => void
  setFreeProUntil: (until: number | null) => void
  markFreeProEndTold: () => void
  setProNudgeAt: (at: number) => void
  markReminded: (ids: string[]) => void
  setProfile: (p: Partial<Profile>) => void
  /** A change here (stamped now), or the account's version (stamped `at`). */
  setMe: (m: Partial<Me>, at?: number) => void
  setOnboarded: (v: boolean) => void
  hideAuthor: (userId: string) => void
  noteString: (name: string) => void
  showAuthor: (userId: string) => void
  showAllAuthors: () => void
  setAccount: (a: Account | null) => void
  setAccountPro: (p: AccountPro | null) => void
  setSync: (s: Partial<SyncState>) => void
}

/** Ounces and inches where the device says the US; grams and mm elsewhere. */
const browserUnits = (): UnitSystem => (typeof navigator !== 'undefined' && /^en-us$/i.test(navigator.language ?? '') ? 'imperial' : 'metric')

const browserLang = (): Lang => {
  const l = typeof navigator === 'undefined' ? '' : navigator.language?.toLowerCase() ?? ''
  return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en'
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      lang: browserLang(),
      theme: 'system',
      court: 'clay',
      units: browserUnits(),
      masses: DEFAULT_ACCESSORY_MASSES,
      license: null,
      config: defaultConfig(),
      loadedSetupId: null,
      mapIds: [],
      compare: [],
      freePlans: [],
      fleetRef: null,
      lastProId: null,
      freeProUntil: null,
      freeProEndTold: false,
      proNudgeAt: null,
      reminded: [],
      profile: {},
      me: {},
      onboarded: false,
      hiddenAuthors: [],
      recentStrings: [],
      account: null,
      accountPro: null,
      sync: { userId: null, cursor: null },

      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setCourt: (court) => set({ court }),
      setUnits: (units) => set({ units }),
      setMasses: (m) => set((s) => ({ masses: { ...s.masses, ...m } })),
      setTape: (tapeGPer10cm) => set({ tapeGPer10cm }),
      setLicense: (license) => set({ license }),
      toggleMap: (id) => set((s) => ({ mapIds: s.mapIds.includes(id) ? s.mapIds.filter((x) => x !== id) : [...s.mapIds, id].slice(-MAP_MAX) })),
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
      addFreePlan: (key) => set((s) => ({ freePlans: withPlan(s.freePlans, key) })),
      setFleetRef: (fleetRef) => set({ fleetRef }),
      setLastPro: (lastProId) => set({ lastProId }),
      setFreeProUntil: (freeProUntil) => set({ freeProUntil }),
      markFreeProEndTold: () => set({ freeProEndTold: true }),
      setProNudgeAt: (proNudgeAt) => set({ proNudgeAt }),
      setAccount: (account) => set({ account }),
      setAccountPro: (accountPro) => set({ accountPro }),
      setSync: (sync) => set((s) => ({ sync: { ...s.sync, ...sync } })),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setMe: (m, at = Date.now()) => set((s) => ({ me: { ...s.me, ...m, at } })),
      setOnboarded: (onboarded) => set({ onboarded }),
      hideAuthor: (id) => set((s) => ({ hiddenAuthors: [...new Set([...s.hiddenAuthors, id])] })),
      noteString: (name) =>
        set((s) => {
          const n = name.trim()
          return n ? { recentStrings: [n, ...s.recentStrings.filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 8) } : {}
        }),
      showAuthor: (id) => set((s) => ({ hiddenAuthors: s.hiddenAuthors.filter((x) => x !== id) })),
      showAllAuthors: () => set({ hiddenAuthors: [] }),
      markReminded: (ids) => set((s) => ({ reminded: [...new Set([...s.reminded, ...ids])].slice(-200) })),
    }),
    {
      name: 'swingmath',
      version: 5,
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
        // v4: a few stock ids changed with corrected years.
        if (version < 4 && s.config?.racketId && RENAMED[s.config.racketId]) s.config = { ...s.config, racketId: RENAMED[s.config.racketId] }
        // v3: a sleeve mass was added; keep the user's own masses.
        if (version < 3 && s.masses) s.masses = { ...DEFAULT_ACCESSORY_MASSES, ...s.masses }
        // v5: free plans of the solver, counted by plan, not by run.
        if (version < 5) {
          delete (s as { freeRunsUsed?: number }).freeRunsUsed
          s.freePlans = []
        }
        return s as State
      },
    },
  ),
)

const DAY = 86_400_000

/** Pro through the account: a running subscription, or the paid rest of a
 *  cancelled one. Offline, it holds for 30 days after the last check. */
export function accountProActive(p: AccountPro | null, now = Date.now()) {
  if (!p || now - p.checkedAt > 30 * DAY) return false
  if (['on_trial', 'active', 'past_due'].includes(p.status)) return true
  return p.status === 'cancelled' && !!p.endsAt && Date.parse(p.endsAt) > now
}

export const isPro = (s: { license: License | null; accountPro?: AccountPro | null; freeProUntil?: number | null }) =>
  PRO_BETA ||
  (s.license !== null && (s.license.status ?? 'active') === 'active') ||
  accountProActive(s.accountPro ?? null) ||
  freeProActive(s.freeProUntil)

/** Keeps an edited profile: the photo stamped when it changed, a blank name as none. */
export function keepMe(draft: Me, now = Date.now()) {
  const { me, setMe } = useStore.getState()
  setMe({ name: draft.name?.trim() || undefined, color: draft.color, photo: draft.photo, ...(draft.photo !== me.photo && { photoAt: now }) }, now)
}
/** Rackets on the map at once; more and the labels crowd. */
export const MAP_MAX = 8
/** Sessions the free journal shows. */
