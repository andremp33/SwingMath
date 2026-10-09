// Deploy: npx supabase functions deploy ls-webhook --no-verify-jwt
// Secrets: npx supabase secrets set LS_WEBHOOK_SECRET=... LS_STORE_ID=...
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle, subscriptionUpsert } from './handler.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const res = await handle(await req.text(), req.headers.get('x-signature'), {
    secret: Deno.env.get('LS_WEBHOOK_SECRET')!,
    storeId: Deno.env.get('LS_STORE_ID') || undefined,
    upsert: subscriptionUpsert(db),
  })
  return new Response(res.body, { status: res.status })
})
