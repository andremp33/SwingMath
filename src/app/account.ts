import type { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { db } from '../data/db'
import { accountProActive, useStore, type AccountPro } from '../data/store'
import { enqueueAll, supabaseRemote, syncOnce, SyncError, trackChanges } from '../data/sync'
import { cloudConfigured, getCloud } from '../lib/cloud'

/**
 * Optional account: sign-in with a code by email, the subscription the
 * server knows about, and sync (Pro). Nothing here runs unless the cloud is
 * configured.
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
  const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}settings` } }).catch(() => ({ error: { status: 0 } }))
  if (error) throw new AccountError(kindOf(error))
}

export async function verifyCode(email: string, code: string) {
  const c = await client()
  const { error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }).catch(() => ({ error: { status: 0 } }))
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
  const { error } = await c.rpc('delete_account')
  if (error) throw new AccountError(kindOf(error))
  await c.auth.signOut({ scope: 'local' })
  store().setAccount(null)
  store().setAccountPro(null)
  store().setSync({ userId: null, cursor: null, lastAt: undefined, error: undefined })
}

const RANK = ['on_trial', 'active', 'past_due', 'cancelled', 'paused', 'unpaid', 'expired']

export async function refreshSubscription(): Promise<AccountPro | null> {
  const c = await client()
  const { data, error } = await c.from('subscriptions').select('status, ends_at')
  if (error) return store().accountPro
  // A player may have an old expired row and a new active one.
  const best = (data ?? []).sort((a, b) => RANK.indexOf(a.status) - RANK.indexOf(b.status))[0]
  const pro = best ? { status: best.status as string, endsAt: (best.ends_at as string | null) ?? null, checkedAt: Date.now() } : null
  store().setAccountPro(pro)
  return pro
}

let running: Promise<void> | null = null

/** One sync, if signed in with Pro. Concurrent calls share the same run. */
export function syncNow(): Promise<void> {
  running ??= (async () => {
    const { account, accountPro, sync, setSync } = store()
    if (!account || !accountProActive(accountPro)) return
    const c = await client()
    // First sync for this account: send everything already on the device.
    let cursor = sync.cursor
    if (sync.userId !== account.userId) {
      await enqueueAll(db)
      cursor = null
      setSync({ userId: account.userId, cursor: null })
    }
    try {
      const r = await syncOnce(db, supabaseRemote(c), cursor)
      setSync({ cursor: r.cursor, lastAt: Date.now(), error: undefined })
    } catch (e) {
      setSync({ error: e instanceof SyncError && e.code === '42501' ? 'nopro' : navigator.onLine ? 'other' : 'offline' })
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

async function onSession(session: Session | null) {
  if (!session?.user.email) {
    store().setAccount(null)
    return
  }
  store().setAccount({ userId: session.user.id, email: session.user.email })
  await refreshSubscription()
  await syncNow()
}

/** Mount once: follows the session, syncs after changes and on return. */
export function useAccountSync() {
  useEffect(() => {
    const c = getCloud()
    if (!cloudConfigured() || !c) return
    trackChanges(db, soon)
    let unsub: (() => void) | undefined
    c.then((cl) => {
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
