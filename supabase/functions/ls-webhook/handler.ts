/**
 * Lemon Squeezy webhook: keeps public.subscriptions in step with the store.
 * Pure logic, so it runs in Deno (the function) and in Node (the tests).
 */
export interface SubscriptionRow {
  email: string
  user_id: string | null
  status: string
  renews_at: string | null
  ends_at: string | null
  ls_subscription_id: string
  updated_at: string
}

export interface Deps {
  secret: string
  /** Only events from this store count. */
  storeId?: string
  upsert: (row: SubscriptionRow) => Promise<void>
}

const STATUSES = new Set(['on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
}

/** Compares in constant time, so the signature cannot be guessed byte by byte. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function handle(body: string, signature: string | null, deps: Deps): Promise<{ status: number; body: string }> {
  if (!deps.secret || !signature || !same(signature.toLowerCase(), await sign(deps.secret, body))) return { status: 401, body: 'bad signature' }
  let event: {
    meta?: { event_name?: string; custom_data?: { user_id?: string } }
    data?: { type?: string; id?: string; attributes?: Record<string, unknown> }
  }
  try {
    event = JSON.parse(body)
  } catch {
    return { status: 400, body: 'bad json' }
  }
  const a = event.data?.attributes ?? {}
  // Only subscription events change Pro; acknowledge the rest.
  if (event.data?.type !== 'subscriptions' || !event.meta?.event_name?.startsWith('subscription_')) return { status: 200, body: 'ignored' }
  if (deps.storeId && String(a.store_id) !== String(deps.storeId)) return { status: 200, body: 'other store' }
  const email = typeof a.user_email === 'string' ? a.user_email.trim().toLowerCase() : ''
  const status = String(a.status)
  if (!email || !STATUSES.has(status)) return { status: 400, body: 'missing email or status' }
  const uid = event.meta.custom_data?.user_id
  await deps.upsert({
    email,
    user_id: uid && UUID.test(uid) ? uid : null,
    status,
    renews_at: (a.renews_at as string | null) ?? null,
    ends_at: (a.ends_at as string | null) ?? null,
    ls_subscription_id: String(event.data.id),
    updated_at: new Date().toISOString(),
  })
  return { status: 200, body: 'ok' }
}

/** Minimal shape of a Supabase client, so this file needs no imports. */
interface Db {
  from(table: 'subscriptions'): { upsert(row: object, opts: { onConflict: string }): PromiseLike<{ error: unknown }> }
}

/** Writes a row; keeps the account link if a later event comes without it. */
export const subscriptionUpsert = (db: Db) => async (row: SubscriptionRow) => {
  const { user_id, ...rest } = row
  const { error } = await db.from('subscriptions').upsert(user_id ? row : rest, { onConflict: 'email' })
  if (error) throw error
}
