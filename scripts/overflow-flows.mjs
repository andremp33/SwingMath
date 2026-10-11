// Sideways overflow with real data and open sheets, on a small phone.
//   node scripts/overflow-flows.mjs [port] [width]
import { chromium, devices } from '@playwright/test'
const port = process.argv[2] ?? '5175'
const w = Number(process.argv[3] ?? 360)
const base = `http://localhost:${port}`
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: w, height: 760 } })
const p = await ctx.newPage()
await p.addInitScript(() => { if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ version: 3, state: { lang: 'pt', license: { provider: 'dev', activatedAt: 1 } } })) })
let bad = 0
async function check(label) {
  await p.waitForTimeout(350)
  const over = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (!r.width || el.closest('.sr-only')) continue
      // Scrollable boxes may hold wide content on purpose.
      if (el.parentElement && getComputedStyle(el.parentElement).overflowX.match(/auto|scroll/)) continue
      if (r.right > vw + 0.5 || r.left < -0.5) {
        if (!out.some((o) => o.el.contains(el))) out.push({ el, d: `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 50)}" right=${Math.round(r.right)}` })
      }
    }
    return out.slice(0, 5).map((o) => o.d)
  })
  if (over.length) {
    bad++
    console.log(`${w}px ${label}`)
    for (const o of over) console.log('   ', o)
  }
}
await p.goto(base + '/')
await check('calc')
for (const n of ['12h (ponta)', '3h e 9h', 'Cabo']) await p.getByRole('button', { name: `+ 0,5 g ${n}` }).click()
await p.getByRole('button', { name: 'Adicionar posição' }).click(); await check('add position sheet'); await p.keyboard.press('Escape')
await p.getByRole('button', { name: /Raquete Babolat/ }).first().click(); await check('racket picker'); await p.keyboard.press('Escape')
for (const name of ['Mais estabilidade e potência no serviço', 'Base']) {
  await p.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
  await check('save sheet')
  await p.getByRole('dialog').getByLabel('Nome').fill(name)
  await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await p.waitForTimeout(300)
}
await p.getByRole('button', { name: /Confirmar com a minha medição/ }).click().catch(() => {})
await check('calc with lead + verify')
await p.goto(base + '/setups'); await check('setups list')
await p.getByRole('button', { name: 'Partilhar' }).first().click(); await check('share sheet'); await p.keyboard.press('Escape')
await p.getByRole('button', { name: /Editar/ }).first().click().catch(() => {}); await check('edit setup sheet'); await p.keyboard.press('Escape')
await p.getByRole('button', { name: /Escolher para comparar/ }).nth(0).click(); await p.getByRole('button', { name: /Escolher para comparar/ }).nth(0).click().catch(() => {})
await p.goto(base + '/setups/compare'); await check('compare')
await p.goto(base + '/diario')
await p.getByRole('button', { name: 'Encordei' }).first().click(); await check('stringing sheet')
await p.getByRole('dialog').getByLabel('Nome da raquete').fill('Pure Aero 98 de torneio #1')
await p.getByRole('dialog').getByRole('switch', { name: /Híbrido/ }).click(); await check('stringing sheet hybrid')
await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(300)
await p.getByRole('button', { name: 'Registar sessão' }).click(); await check('session sheet')
await p.getByRole('dialog').getByRole('radiogroup', { name: 'Geral' }).getByRole('radio', { name: '4/5' }).click()
await p.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(300)
await check('journal with data')
await p.goto(base + '/match')
await p.getByRole('region', { name: 'Alvo', exact: true }).getByLabel('Peso', { exact: true }).fill('325')
await p.getByRole('button', { name: 'Calcular', exact: true }).click(); await check('match result')
await p.getByRole('region', { name: 'Alvo', exact: true }).getByRole('radio', { name: 'Profissional' }).click()
await p.getByRole('radio', { name: /Thiago Seyboth Wild/ }).click(); await check('match pro')
await p.getByRole('radio', { name: 'Igualar raquetes' }).click()
await p.getByRole('button', { name: 'Adicionar raquete' }).click().catch(() => {})
await p.getByRole('button', { name: 'Calcular', exact: true }).click().catch(() => {}); await check('batch result')
await p.goto(base + '/settings'); await p.getByRole('button', { name: /Ver planos/ }).click().catch(() => {}); await check('pro sheet'); await p.keyboard.press('Escape')
await p.goto(base + '/cordas'); await check('cordas')
await p.goto(base + '/rackets/new'); await check('new racket')
console.log(bad ? `${bad} states overflow` : 'no horizontal overflow')
await b.close()
