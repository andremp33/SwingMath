// Visual review of the account and community cards, against a local Supabase
// with the dev server on 5174 (see playwright.cloud.config.ts):
//   node scripts/cloud-look.mjs <theme> <width>
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const [theme = 'light', width = '390'] = process.argv.slice(2)
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } })
const rid = 'stock-babolat-pure-aero-98-2026'
const stamp = Date.now()
const ids = []
for (const [i, w] of [319.5, 322, 323.5, 326].entries()) {
  const { data } = await admin.auth.admin.createUser({ email: `look${i}-${stamp}@example.test`, email_confirm: true })
  ids.push(data.user.id)
  await admin.from('measurements').insert({ user_id: data.user.id, racket_id: rid, strung: true, weight_g: w, balance_cm: 32.4 + i * 0.05, swingweight: 321 + i })
}
const lead = (tip, three, handle) => ({ tip, tenTwo: 0, threeNine: three, throat: 0, handle })
const base = { racketId: rid, baseMode: 'reference', measured: {}, accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false } }
await admin.from('public_setups').insert([
  { user_id: ids[0], racket_id: rid, name: 'Mais estabilidade', author: 'Rui', config: { ...base, leadG: lead(0, 3, 2) }, specs: { weightG: 334, balanceCm: 32.3, swingweight: 331 }, copies: 14 },
  { user_id: ids[1], racket_id: rid, name: 'Plow para o serviço', author: null, config: { ...base, leadG: lead(2, 0, 0) }, specs: { weightG: 331, balanceCm: 32.9, swingweight: 335 }, copies: 3 },
])

const w = Number(width)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: w > 800 ? 900 : 844 }, colorScheme: theme })
await p.addInitScript((th) => localStorage.setItem('swingmath', JSON.stringify({ version: 3, state: { lang: 'pt', theme: th } })), theme)
await p.goto('http://localhost:5174/')
const card = p.getByRole('region', { name: 'Comunidade' })
await card.getByText('Mais estabilidade').waitFor()
await card.screenshot({ path: `replica/review/v3-community-${theme}-${width}.png` })
await p.goto('http://localhost:5174/settings')
const acc = p.getByRole('region', { name: 'Conta' })
await acc.waitFor()
await acc.screenshot({ path: `replica/review/v3-account-${theme}-${width}.png` })
await b.close()
for (const id of ids) await admin.auth.admin.deleteUser(id)
console.log('ok')
