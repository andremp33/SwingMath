import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional accounts (Supabase). Without VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY the app has no account features and works as
 * before. The client loads on first use, so the calculator opens without it.
 */
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || undefined
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || undefined

export const cloudConfigured = () => Boolean(URL && KEY)

let client: Promise<SupabaseClient> | null = null
const waiting: ((c: SupabaseClient) => void)[] = []

const STORAGE_KEY = 'swingmath-auth'
const DEVICE_KEY = 'swingmath-device'
let deviceMemo: string | undefined

/** This device, for the sync (without Pro, one device syncs at a time):
 *  made once and kept with the app's data. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) localStorage.setItem(DEVICE_KEY, (id = crypto.randomUUID()))
    return id
  } catch {
    return (deviceMemo ??= crypto.randomUUID())
  }
}

/** The database's requests carry the device; the functions' do not (their
 *  CORS would refuse a header they do not know). */
const withDevice: typeof fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (!url.includes('/rest/v1/')) return fetch(input, init)
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set('x-swing-device', deviceId())
  return fetch(input, { ...init, headers })
}

export function getCloud(): Promise<SupabaseClient> | null {
  if (!cloudConfigured()) return null
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL!, KEY!, {
        // The sign-in email carries a link (default template) and, with a
        // custom template, a code; the link lands back here with the session.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORAGE_KEY },
        global: { fetch: withDevice },
      }),
    )
    void client.then((c) => waiting.splice(0).forEach((f) => f(c)))
  }
  return client
}

/** Runs `f` with the client once something loads it (now, if it has). */
export function whenCloud(f: (c: SupabaseClient) => void) {
  if (client) void client.then(f)
  else waiting.push(f)
}

/** Signed in on this device before (a session is stored), or arriving with
 *  a sign-in link: the client is needed at start. Otherwise it waits. */
export function sessionLikely(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return true
  } catch {
    // No storage: nothing stored either.
  }
  return /access_token=|[?&]code=/.test(location.hash + location.search)
}
