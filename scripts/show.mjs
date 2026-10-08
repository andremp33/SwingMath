// Phone-size screenshots of the main screens, for showing the app remotely.
import { chromium } from '@playwright/test'
const B = 'http://localhost:5173'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'pt-PT' })
await ctx.addInitScript(() => {
  if (localStorage.getItem('swingmath')) return
  localStorage.setItem('swingmath', JSON.stringify({ version: 2, state: { lang: 'pt', theme: 'dark', tapeGPer10cm: 4, config: { racketId: 'stock-babolat-pure-aero-98-2026', baseMode: 'reference', measured: {}, accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false }, leadG: { tip: 2, tenTwo: 0, threeNine: 2, throat: 0, handle: 0 }, extra: [{ id: 'a', kind: 'hoop', hour: 11, sides: 2, grams: 1.5 }] } } }))
})
const p = await ctx.newPage()
const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `replica/review/app-${name}.png` }) }
await p.goto(B + '/')
await p.getByRole('heading', { name: 'Calculadora' }).waitFor()
await shot('1-calculadora')
await p.getByRole('heading', { name: 'Outras posições' }).scrollIntoViewIfNeeded()
await p.evaluate(() => window.scrollBy(0, -260))
await shot('2-chumbo')
await p.getByRole('region', { name: 'Resultado' }).scrollIntoViewIfNeeded()
await shot('3-resultado')
await p.goto(B + '/rackets')
await p.getByRole('article').first().waitFor()
await shot('4-raquetes')
await p.goto(B + '/medir')
await p.getByLabel('Peso', { exact: true }).fill('323')
await p.getByLabel('Equilíbrio', { exact: true }).fill('325')
await p.getByLabel(/Ou escreve/).fill('26,6')
await p.getByRole('button', { name: 'Juntar tentativa' }).click()
await p.getByTestId('measured-sw').scrollIntoViewIfNeeded()
await shot('5-medir')
await b.close()
