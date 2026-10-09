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

export function getCloud(): Promise<SupabaseClient> | null {
  if (!cloudConfigured()) return null
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'swingmath-auth' },
    }),
  )
  return client
}
