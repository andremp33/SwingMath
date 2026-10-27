import type { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { db, ensureOwned } from '../data/db'
import { useStore, type AccountPro } from '../data/store'
import { enqueueAll, supabaseRemote, SyncError, syncOnce, trackChanges } from '../data/sync'
import { cloudConfigured, getCloud, sessionLikely, whenCloud } from '../lib/cloud'
import { IS_NATIVE, IS_PREVIEW } from '../lib/platform'

/**
 * Optional account: sign-in with a code by email, the subscription the
 * server knows about, and sync (one device at a time without Pro). Nothing
 * here runs unless the cloud is configured.
 */
const store = () => useStore.getState()

export class AccountError extends Error {
  kind: 'offline' | 'invalid' | 'rate' | 'config'
  constructor(kind: AccountError['kind']) {
    super(kind)
    this.kind = kind
  }
}

const kindOf = (e: { status?: number; message?: string; code?: string } | null): AccountError['kind'] =>
  !e ? 'invalid' : e.status === 429 || e.code === 'over_email_send_rate_limit' ? 'rate' : e.status === 0 || /fetch/i.test(e.message ?? '') ? 'offline' : 'invalid'

async function client() {
  const c = getCloud()
  if (!c) throw new AccountError('config')
  return c
}

export async function sendCode(email: string) {
  const c = await client()
  const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: IS_NATIVE ? 'app.swingmath://auth' : `${location.origin}${import.meta.env.BASE_URL}${IS_PREVIEW ? '' : 'perfil'}` } }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
}

export async function verifyCode(email: string, code: string) {
  const c = await client()
  const { error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
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
}

/** Deletes the account and its cloud data. This device keeps its own copy. */
export async function deleteAccount() {
  const c = await client()
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
      })
      unsub = () => data.subscription.unsubscribe()
    })
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !store().account) return
      void refreshSubscription().then(() => syncNow())
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      unsub?.()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [])
}
