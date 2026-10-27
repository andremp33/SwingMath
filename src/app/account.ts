import type { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { create } from 'zustand'
import { db, ensureOwned } from '../data/db'
import { AVATAR_COLORS, useStore, type AccountPro, type AvatarColor, type Me } from '../data/store'
import { enqueueAll, supabaseRemote, SyncError, syncOnce, trackChanges } from '../data/sync'
import { cloudConfigured, getCloud, sessionLikely, whenCloud } from '../lib/cloud'
import { photoBlob, photoDataUrl } from '../lib/photo'
import { IS_NATIVE, IS_PREVIEW } from '../lib/platform'

/**
 * Optional account: sign-in with a code by email, the subscription the
 * server knows about, and sync (one device at a time without Pro). Nothing
 * here runs unless the cloud is configured.
 */
const store = () => useStore.getState()

export class AccountError extends Error {
  kind: 'offline' | 'invalid' | 'rate' | 'config' | 'taken'
  constructor(kind: AccountError['kind']) {
    super(kind)
    this.kind = kind
  }
}

const kindOf = (e: { status?: number; message?: string; code?: string } | null): AccountError['kind'] =>
  !e ? 'invalid' : e.code === 'email_exists' ? 'taken' : e.status === 429 || e.code === 'over_email_send_rate_limit' ? 'rate' : e.status === 0 || /fetch/i.test(e.message ?? '') ? 'offline' : 'invalid'

async function client() {
  const c = getCloud()
  if (!c) throw new AccountError('config')
  return c
}

const redirectTo = () => (IS_NATIVE ? 'app.swingmath://auth' : `${location.origin}${import.meta.env.BASE_URL}${IS_PREVIEW ? '' : 'perfil'}`)

export async function sendCode(email: string) {
  const c = await client()
  const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: redirectTo() } }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
}

/** Signs in; true when the account has no name or photo yet (a new one). */
export async function verifyCode(email: string, code: string): Promise<boolean> {
  const c = await client()
  const { data, error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }).catch(() => ({ data: { user: null }, error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
  return !cloudMe(data.user?.user_metadata)
}

/** Asks for a new email: a code goes to it and, with secure email change
 *  (the default), another to the current one. */
export async function changeEmail(email: string) {
  const c = await client()
  const { error } = await c.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirectTo() }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
}

/** Confirms one code of an email change, the one sent to `email`. True once
 *  the account has the new email; false while the other code is missing. */
export async function confirmEmailCode(email: string, code: string, newEmail: string): Promise<boolean> {
  const c = await client()
  const { error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
  // Asked, not read from the token: the change may have just completed.
  const { data } = await c.auth.getUser()
  const now = data.user?.email
  const account = store().account
  if (now && account && now !== account.email) store().setAccount({ ...account, email: now })
  return now?.toLowerCase() === newEmail.trim().toLowerCase()
}

/** The App Store and Google Play reviewers' account signs in with a
 *  password (they cannot receive our email); nobody else can. */
export const REVIEW_EMAIL = ((import.meta.env.VITE_REVIEW_EMAIL as string | undefined) || '').trim().toLowerCase() || null
export const isReviewEmail = (email: string) => !!REVIEW_EMAIL && email.trim().toLowerCase() === REVIEW_EMAIL

export async function signInWithPassword(email: string, password: string) {
  if (!isReviewEmail(email)) throw new AccountError('invalid')
  const c = await client()
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
}

export async function signOut() {
  const c = await client()
  await c.auth.signOut({ scope: 'local' })
  store().setAccount(null)
  store().setAccountPro(null)
  useMeSync.setState({ state: 'idle' })
}

/** Deletes the account and its cloud data. This device keeps its own copy. */
export async function deleteAccount() {
  const c = await client()
  // The photo first: the database cannot delete stored files itself.
  const id = store().account?.userId
  if (id) await c.storage.from(AVATARS).remove([photoPath(id)]).catch(() => {})
  // The function also deletes the RevenueCat customer. Until it is
  // deployed (it answers 404), the database deletes the account itself.
  const { error } = await c.functions.invoke('delete-account', { method: 'POST' })
  if (error) {
    // An HTTP error from the function (by name: the class would load the
    // whole Supabase library at start).
    const http = error.name === 'FunctionsHttpError'
    const notThere = http && (error.context as Response).status === 404
    if (!notThere) throw new AccountError(http ? 'invalid' : 'offline')
    const fallback = await c.rpc('delete_account')
    if (fallback.error) throw new AccountError(kindOf(fallback.error))
  }
  await c.auth.signOut({ scope: 'local' })
  store().setAccount(null)
  store().setAccountPro(null)
  store().setSync({ userId: null, cursor: null, lastAt: undefined, error: undefined })
  useMeSync.setState({ state: 'idle' })
}

/** The account's Pro, as the stores report it through RevenueCat's webhook
 *  (one row per account; a lifetime purchase has no end). */
export async function refreshSubscription(): Promise<AccountPro | null> {
  const c = await client()
  const { data, error } = await c.from('store_subscriptions').select('status, ends_at').maybeSingle()
  if (error) return store().accountPro
  const pro = data ? { status: data.status as string, endsAt: (data.ends_at as string | null) ?? null, checkedAt: Date.now() } : null
  store().setAccountPro(pro)
  return pro
}

let running: Promise<void> | null = null

/** A server from before the one-device rule has no such function. */
const missing = (e: { code?: string } | null) => e?.code === 'PGRST202'

/** Without Pro, one device syncs at a time: this one, from now on. */
async function claim() {
  const c = await client()
  const { error } = await c.rpc('claim_sync_device')
  if (error && !missing(error)) throw new SyncError(error.message, error.code)
}

/** Takes the sync back from the account's other device, and syncs. */
export async function syncHere() {
  try {
    await claim()
  } catch {
    store().setSync({ error: navigator.onLine ? 'other' : 'offline' })
    return
  }
  await syncNow()
}

/** One sync, if signed in. Concurrent calls share the same run. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    const { account, sync, setSync } = store()
    if (!account) return
    const c = await client()
    try {
      // First sync for this account here: signing in moves the sync to this
      // device, and everything already on it is sent.
      let cursor = sync.cursor
      if (sync.userId !== account.userId) {
        await claim()
        await enqueueAll(db)
        cursor = null
        setSync({ userId: account.userId, cursor: null })
      }
      // Asked first: without the sync, the server would answer with nothing.
      const here = await c.rpc('sync_here')
      if (!here.error && here.data === false) return setSync({ error: 'elsewhere' })
      const r = await syncOnce(db, supabaseRemote(c), cursor)
      // Another device on an older version may have sent unlinked stringings.
      if (r.pulled) await ensureOwned()
      setSync({ cursor: r.cursor, lastAt: Date.now(), error: undefined })
    } catch (e) {
      // Refused by the rules: another device took the sync meanwhile.
      setSync({ error: e instanceof SyncError && e.code === '42501' ? 'elsewhere' : navigator.onLine ? 'other' : 'offline' })
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** The profile's name and photo on the account: the name, the colour and
 *  the stamps in the account's metadata, the photo in Storage at
 *  avatars/<user id>/avatar.jpg. The newer of this device and the account
 *  wins, as for the synced data. */
const AVATARS = 'avatars'
const photoPath = (userId: string) => `${userId}/avatar.jpg`

export interface CloudMe {
  name?: string
  color?: AvatarColor
  /** The photo's stamp; null: no photo. */
  photo: number | null
  at: number
}

/** The account's metadata, as the profile it holds (none set: null). */
export function cloudMe(meta: Record<string, unknown> | undefined): CloudMe | null {
  const a = meta?.avatar as { at?: unknown; photo?: unknown; color?: unknown } | undefined
  if (!a || typeof a.at !== 'number') return null
  const name = meta?.display_name
  return {
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : undefined,
    color: AVATAR_COLORS.find((c) => c === a.color),
    photo: typeof a.photo === 'number' ? a.photo : null,
    at: a.at,
  }
}

/** What a sync does: take the account's profile, or send this device's
 *  (stamped `at`, the photo's stamp `photo`), and whether the photo travels
 *  with it; null when both are the same. */
export function mePlan(me: Me, remote: CloudMe | null) {
  const at = me.at ?? 0
  const photo = me.photo ? (me.photoAt ?? at) : null
  if (remote && remote.at > at) return { take: true, photoMoves: remote.photo !== photo, at, photo }
  if (at > (remote?.at ?? 0)) return { take: false, photoMoves: photo !== (remote?.photo ?? null), at, photo }
  return null
}

type MeSyncState = 'idle' | 'sending' | 'offline' | 'failed'
/** How the profile's last trip to the account went (not kept). */
export const useMeSync = create<{ state: MeSyncState }>(() => ({ state: 'idle' }))

let meRunning: Promise<void> | null = null
let meAgain = false

/** Sends or fetches the profile, if signed in. A change made while it runs
 *  goes right after. */
export function syncMe(): Promise<void> {
  if (meRunning) {
    meAgain = true
    return meRunning
  }
  meRunning = (async () => {
    do {
      meAgain = false
      await syncMeOnce()
    } while (meAgain)
  })().finally(() => {
    meRunning = null
  })
  return meRunning
}

async function syncMeOnce() {
  const account = store().account
  if (!account) return
  const set = (state: MeSyncState) => useMeSync.setState({ state })
  try {
    const c = await client()
    // Asked each time: another device may have changed it.
    const { data, error } = await c.auth.getUser()
    if (error || !data.user) throw error ?? new Error('no user')
    if (data.user.id !== account.userId) return
    const remote = cloudMe(data.user.user_metadata)
    const me = store().me
    const plan = mePlan(me, remote)
    if (plan?.take && remote) {
      let { photo, photoAt } = me
      if (plan.photoMoves) {
        if (remote.photo) {
          const got = await c.storage.from(AVATARS).download(photoPath(account.userId))
          if (got.error) throw got.error
          photo = await photoDataUrl(got.data)
          photoAt = remote.photo
        } else {
          photo = photoAt = undefined
        }
      }
      // Changed here meanwhile: that is newer, and goes next.
      if ((store().me.at ?? 0) === plan.at) store().setMe({ name: remote.name, color: remote.color, photo, photoAt }, remote.at)
    } else if (plan) {
      set('sending')
      if (plan.photoMoves) {
        const bucket = c.storage.from(AVATARS)
        const r = me.photo
          ? await bucket.upload(photoPath(account.userId), photoBlob(me.photo), { upsert: true, contentType: 'image/jpeg', cacheControl: '0' })
          : await bucket.remove([photoPath(account.userId)])
        if (r.error) throw r.error
      }
      const { error: e } = await c.auth.updateUser({ data: { display_name: me.name ?? null, avatar: { at: plan.at, photo: plan.photo, color: me.color ?? null } } })
      if (e) throw e
    }
    set('idle')
  } catch {
    set(navigator.onLine ? 'failed' : 'offline')
  }
}

let meTimer: ReturnType<typeof setTimeout> | undefined
const meSoon = () => {
  clearTimeout(meTimer)
  meTimer = setTimeout(() => void syncMe(), 1500)
}

let timer: ReturnType<typeof setTimeout> | undefined
const soon = () => {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), 3000)
}

/** Store apps: the RevenueCat user follows the account. */
const identifyStore = (userId: string | null) => {
  if (IS_NATIVE)
    void import('../lib/purchases')
      .then((m) => m.identify(userId))
      .catch(() => {})
}

async function onSession(session: Session | null) {
  if (!session?.user.email) {
    store().setAccount(null)
    identifyStore(null)
    return
  }
  store().setAccount({ userId: session.user.id, email: session.user.email })
  identifyStore(session.user.id)
  void syncMe()
  await refreshSubscription()
  await syncNow()
}

/** Mount once: follows the session, syncs after changes and on return. */
export function useAccountSync() {
  useEffect(() => {
    if (!cloudConfigured()) return
    trackChanges(db, soon)
    let unsub: (() => void) | undefined
    // Never signed in here: the library waits until something needs it
    // (signing in, the community), and the session is followed from then.
    if (sessionLikely()) void getCloud()
    whenCloud((cl) => {
      // INITIAL_SESSION arrives first, then sign-ins and sign-outs. Supabase
      // calls made inside this callback can deadlock, so they run after it.
      const { data } = cl.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => void onSession(session), 0)
        // An email change confirmed by its links (maybe in another tab).
        const account = store().account
        if (event === 'USER_UPDATED' && account && session?.user.email && session.user.email !== account.email) store().setAccount({ ...account, email: session.user.email })
      })
      unsub = () => data.subscription.unsubscribe()
    })
    // The name and photo go to the account a moment after they change.
    const unsubMe = useStore.subscribe((s, prev) => {
      if (s.me !== prev.me && s.account) meSoon()
    })
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !store().account) return
      void syncMe()
      void refreshSubscription().then(() => syncNow())
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      unsub?.()
      unsubMe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [])
}
