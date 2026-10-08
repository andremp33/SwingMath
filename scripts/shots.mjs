// Screenshots of every screen for replica-diff, plus PWA icons.
// Usage: dev server on :5173, then `node scripts/shots.mjs`.
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = 'replica/clone-screens'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

// Icons from the SVG mark.
{
  const svg = readFileSync('public/icon.svg', 'utf8')
  const page = await browser.newPage()
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0;background:#0e1210">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: `public/icon-${size}.png` })
  }
  await page.close()
}

// Social image 1200x630 from the landing hero.
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: 'dark' })
  await page.addInitScript(() => localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt' }, version: 1 })))
  await page.goto(BASE + '/sobre')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'public/og.png' })
  await page.close()
}

const viewports = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } }

for (const [name, vp] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-PT', colorScheme: 'dark' })
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) {
      localStorage.setItem(
        'swingmath',
        JSON.stringify({ state: { lang: 'pt', license: { provider: 'dev', activatedAt: 1 } }, version: 1 }),
      )
    }
  })
  const page = await ctx.newPage()
  const shot = async (id) => {
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/${id}-${name}.png`, fullPage: true })
  }

  await page.goto(BASE + '/')
  await page.getByRole('heading', { name: 'Calculadora' }).waitFor()
  await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
  await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
  await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
  await shot('S01-calculator')
  // Viewport-only product shot for the landing page.
  mkdirSync('public/landing', { recursive: true })
  // Frame the lead section: the drawing, the first controls and the result bar.
  await page.getByRole('heading', { name: 'Chumbo' }).evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
  })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `public/landing/app-${name}.png` })
  await page.evaluate(() => window.scrollTo(0, 0))

  // Two saved setups to fill the lists.
  for (const n of ['Torneio', 'Treino']) {
    await page.getByRole('button', { name: /Guardar (setup|como novo)/ }).first().click()
    await page.getByLabel('Nome').fill(n)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '+ 0,5 g Cabo' }).click()
  }

  await page.goto(BASE + '/rackets')
  await shot('S04-library')
  await page.goto(BASE + '/rackets/new')
  await shot('S05-racket-form')
  await page.goto(BASE + '/setups')
  await page.getByRole('heading', { name: 'Torneio' }).waitFor()
  await shot('S06-setups')
  for (const b of await page.getByRole('button', { name: 'Escolher para comparar' }).all()) await b.click()
  await page.goto(BASE + '/setups/compare')
  await shot('S08-compare')
  await page.goto(BASE + '/setups')
  await page.getByRole('button', { name: 'Partilhar' }).first().click()
  await page.getByRole('dialog').getByRole('img').waitFor()
  await shot('S09-share')
  await page.goto(BASE + '/match')
  await page.getByRole('button', { name: 'Calcular' }).last().waitFor()
  await page.getByLabel('Peso').nth(1).fill('320')
  await page.getByLabel('Swingweight').nth(1).fill('300')
  await page.getByRole('button', { name: 'Calcular', exact: true }).last().click()
  await shot('S10-hit-target')
  await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
  await shot('S11-match-rackets')
  await page.goto(BASE + '/settings')
  await shot('S12-settings')
  await page.goto(BASE + '/design')
  await shot('design-system')
  await page.goto(BASE + '/sobre')
  await shot('landing')
  await ctx.close()
}

await browser.close()
console.log('screens saved to', OUT)
