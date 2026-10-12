/**
 * RevenueCat webhook: keeps public.store_subscriptions in step with the App
 * Store and Google Play. Events can arrive late, twice or out of order, so
 * the event only says who changed; the state is then read fresh from
 * RevenueCat's REST API. Pure logic, so it runs in Deno and in Node.
 */
export interface StoreSubscriptionRow {
  user_id: string
  store: string
  product_id: string | null
  status: 'on_trial' | 'active' | 'past_due' | 'cancelled' | 'expired'
  ends_at: string | null
  sandbox: boolean
  updated_at: string
}

/** The parts of GET /v1/subscribers/{id} used here. */
export interface Subscriber {
  entitlements?: Record<string, { expires_date: string | null; product_identifier: string }>
  subscriptions?: Record<
    string,
    { store?: string; period_type?: string; unsubscribe_detected_at?: string | null; billing_issues_detected_at?: string | null; is_sandbox?: boolean }
  >
}

export interface Deps {
  /** The Authorization header value set in RevenueCat's webhook settings. */
  auth: string
  entitlement?: string
  subscriber: (appUserId: string) => Promise<Subscriber | null>
  upsert: (row: StoreSubscriptionRow) => Promise<void>
  remove: (userId: string) => Promise<void>
  now?: () => number
}

// Only account ids count; anonymous RevenueCat ids ($RCAnonymousID:...) wait
// until the app signs in, which moves the purchase to the account.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Compares in constant time, so the header cannot be guessed byte by byte. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function rowFrom(userId: string, s: Subscriber | null, entitlement: string, now: number): StoreSubscriptionRow | null {
  const ent = s?.entitlements?.[entitlement]
  if (!ent) return null
  const subs = s?.subscriptions ?? {}
  // Google Play keys subscriptions as "product:base-plan" in some responses.
  const key = Object.keys(subs).find((k) => k === ent.product_identifier) ?? Object.keys(subs).find((k) => k.startsWith(`${ent.product_identifier}:`))
  const sub = key ? subs[key] : undefined
  const ends = ent.expires_date
  const status: StoreSubscriptionRow['status'] =
    ends && Date.parse(ends) <= now
      ? 'expired'
      : sub?.billing_issues_detected_at
        ? 'past_due'
        : sub?.unsubscribe_detected_at
          ? 'cancelled'
          : sub?.period_type === 'trial'
            ? 'on_trial'
            : 'active'
  return {
    user_id: userId,
    store: sub?.store ?? 'unknown',
    product_id: ent.product_identifier,
    status,
    ends_at: ends,
    sandbox: sub?.is_sandbox ?? false,
    updated_at: new Date(now).toISOString(),
  }
}

export async function handle(body: string, authorization: string | null, deps: Deps): Promise<{ status: number; body: string }> {
  if (!authorization || !same(authorization, deps.auth)) return { status: 401, body: 'unauthorized' }
  let event: Record<string, unknown> | undefined
  try {
    event = (JSON.parse(body) as { event?: Record<string, unknown> }).event
  } catch {
    return { status: 400, body: 'bad json' }
  }
  if (!event) return { status: 400, body: 'no event' }
  if (event.type === 'TEST') return { status: 200, body: 'test' }

  const list = (v: unknown) => (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string')
  const ids = new Set(
    [event.app_user_id, event.original_app_user_id, event.aliases, event.transferred_from, event.transferred_to].flatMap(list).filter((id) => UUID.test(id)),
  )
  if (!ids.size) return { status: 200, body: 'anonymous' }

  const now = (deps.now ?? Date.now)()
  for (const id of ids) {
    const row = rowFrom(id, await deps.subscriber(id), deps.entitlement ?? 'pro', now)
    if (row) await deps.upsert(row)
    else await deps.remove(id)
  }
  return { status: 200, body: 'ok' }
}
