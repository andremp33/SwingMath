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

export function getCloud(): Promise<SupabaseClient> | null {
  if (!cloudConfigured()) return null
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL!, KEY!, {
        // The sign-in email carries a link (default template) and, with a
        // custom template, a code; the link lands back here with the session.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: STORAGE_KEY },
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
