// Deploy: npx supabase functions deploy delete-account
// Secrets: RC_SECRET_KEY (already set for rc-webhook): the RevenueCat secret
// API key, used to delete the customer. The player's own sign-in token is
// checked here, so the function keeps JWT verification on.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })
  const key = Deno.env.get('RC_SECRET_KEY')
  const res = await handle(req.headers.get('authorization'), {
    userFrom: async (token) => (await admin.auth.getUser(token)).data.user?.id ?? null,
    deleteSubscriber: key
      ? async (id) => {
          const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } })
          if (!r.ok && r.status !== 404) throw new Error(`revenuecat ${r.status}`)
        }
      : null,
    deleteFiles: async (id) => {
      const { error } = await admin.storage.from('avatars').remove([`${id}/avatar.jpg`])
      if (error) throw error
    },
    deleteUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
    },
    allowWithoutRc: Deno.env.get('DELETE_WITHOUT_RC') === 'true',
  }).catch((e) => {
    console.error(e)
    return { status: 500, body: 'error' }
  })
  return new Response(res.body, { status: res.status, headers: cors })
})
