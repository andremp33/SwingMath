// Mobile review: every screen at 390x844 -> replica/review/m-*.png
//   node scripts/mobile-audit.mjs [theme] [port]
import { chromium, devices } from '@playwright/test'
const [theme = 'light', port = '5175'] = process.argv.slice(2)
const base = `http://localhost:${port}`
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], colorScheme: theme })
const p = await ctx.newPage()
await p.addInitScript((th) => {
  if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ version: 3, state: { lang: 'pt', theme: th } }))
}, theme)
const shot = async (name, full = true) => {
  await p.waitForTimeout(500)
  await p.screenshot({ path: `replica/review/m-${name}.png`, fullPage: full })
  console.log(name)
}
await p.goto(base + '/')
await p.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
await p.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
await shot('calc')
await p.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
await shot('save-sheet', false)
await p.getByRole('dialog').getByLabel('Nome').fill('Mais estabilidade')
await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
await p.waitForTimeout(400)
for (const [path, name] of [['/rackets', 'library'], ['/setups', 'setups'], ['/diario', 'journal'], ['/match', 'match'], ['/settings', 'settings'], ['/medir', 'measure'], ['/cordas', 'cordas'], ['/rackets/new', 'racket-new'], ['/sobre', 'landing']]) {
  await p.goto(base + path)
  await shot(name)
}
await p.goto(base + '/match')
await p.getByRole('radio', { name: 'Igualar raquetes' }).click()
await shot('match-batch')
await p.goto(base + '/')
await p.getByRole('button', { name: /Raquete Babolat/ }).first().click()
await shot('picker', false)
await b.close()
