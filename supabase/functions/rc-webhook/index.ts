// Deploy: npx supabase functions deploy rc-webhook --no-verify-jwt
// Secrets: npx supabase secrets set RC_WEBHOOK_AUTH=... RC_SECRET_KEY=sk_...
// In RevenueCat > Integrations > Webhooks: this function's URL, and the same
// RC_WEBHOOK_AUTH value as the Authorization header.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle, type Subscriber } from './handler.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  // Without both secrets nothing can be checked, so nothing is accepted.
  const auth = Deno.env.get('RC_WEBHOOK_AUTH')
  const key = Deno.env.get('RC_SECRET_KEY')
  if (!auth || !key) return new Response('not configured', { status: 503 })
  try {
    const res = await handle(await req.text(), req.headers.get('authorization'), {
      auth,
      subscriber: async (id) => {
        const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } })
        if (!r.ok) throw new Error(`revenuecat ${r.status}`)
        return ((await r.json()) as { subscriber?: Subscriber }).subscriber ?? null
      },
      upsert: async (row) => {
        const { error } = await db.from('store_subscriptions').upsert(row)
        if (error) throw error
      },
      remove: async (userId) => {
        const { error } = await db.from('store_subscriptions').delete().eq('user_id', userId)
        if (error) throw error
      },
    })
    return new Response(res.body, { status: res.status })
  } catch (e) {
    // A 5xx makes RevenueCat retry later.
    console.error(e)
    return new Response('retry', { status: 500 })
  }
})
