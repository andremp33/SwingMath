// Visual review of the journal, strings and grip: node scripts/journal-look.mjs <theme> <width>
import { chromium } from '@playwright/test'
const [theme = 'light', width = '390'] = process.argv.slice(2)
const w = Number(width)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: w > 800 ? 900 : 844 }, colorScheme: theme })
await p.addInitScript((th) => {
  if (!localStorage.getItem('swingmath'))
    localStorage.setItem('swingmath', JSON.stringify({ version: 3, state: { lang: 'pt', theme: th, license: { provider: 'dev', activatedAt: 1 } } }))
}, theme)
const base = 'http://localhost:5173'
await p.goto(base + '/diario')
const add = async (label, kg) => {
  await p.getByRole('button', { name: /^Encordei/ }).first().click()
  const d = p.getByRole('dialog', { name: 'Encordoamento' })
  await d.getByLabel('Nome da raquete').fill(label)
  if (kg) await d.getByLabel('Tensão').fill(String(kg))
  await d.getByRole('button', { name: 'Guardar' }).click()
  await d.waitFor({ state: 'hidden' })
}
const log = async (min, o, c) => {
  await p.getByRole('button', { name: 'Registar sessão' }).click()
  const d = p.getByRole('dialog', { name: 'Sessão' })
  await d.getByLabel('Duração').fill(String(min))
  await d.getByRole('radiogroup', { name: 'Geral' }).getByRole('radio', { name: `${o}/5` }).click()
  if (c) await d.getByRole('radiogroup', { name: 'Conforto' }).getByRole('radio', { name: `${c}/5` }).click()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await d.waitFor({ state: 'hidden' })
}
await add('Pure Aero #1', 24)
await log(90, 3, 2)
await add('Blade 98', 22)
await log(120, 4, 4)
await log(600, 5, 4)
await log(600, 4, 4)
await p.waitForTimeout(400)
const shot = async (name, full = true) => {
  const out = `replica/review/v2-${name}-${theme}-${width}.png`
  await p.screenshot({ path: out, fullPage: full })
  console.log(out)
}
await shot('journal')
await p.getByRole('button', { name: 'Registar sessão' }).click()
await p.waitForTimeout(300)
await shot('session-sheet', false)
await p.keyboard.press('Escape')
await p.goto(base + '/')
await p.waitForTimeout(600)
await shot('calc')
await p.goto(base + '/cordas')
await p.waitForTimeout(600)
await shot('cordas')
await b.close()
