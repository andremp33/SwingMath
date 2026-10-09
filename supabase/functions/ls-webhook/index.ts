// Deploy: npx supabase functions deploy ls-webhook --no-verify-jwt
// Secrets: npx supabase secrets set LS_WEBHOOK_SECRET=... LS_STORE_ID=...
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle, subscriptionUpsert } from './handler.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  // Without a secret nothing can be verified, so nothing is accepted.
  const secret = Deno.env.get('LS_WEBHOOK_SECRET')
  if (!secret) return new Response('not configured', { status: 503 })
  const res = await handle(await req.text(), req.headers.get('x-signature'), {
    secret,
    storeId: Deno.env.get('LS_STORE_ID') || undefined,
    upsert: subscriptionUpsert(db),
  })
  return new Response(res.body, { status: res.status })
})
