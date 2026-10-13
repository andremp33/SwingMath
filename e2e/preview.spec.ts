import { readFileSync } from 'node:fs'
import { a11y, expect, saveSetup, test } from './fixtures'
import type { Page } from '@playwright/test'

// The store app's private preview (`npm run build:preview`, at /preview/),
// as an iPhone opens it from the home screen: WebKit, no plugins, no stores.
async function open(page: Page, route = '/', state: Record<string, unknown> = { onboarded: true }) {
  await page.addInitScript((s) => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt', ...s }, version: 4 }))
    // What the share sheet copies (WebKit's clipboard needs a real tap).
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void ((window as unknown as { copied: string }).copied = t) } })
  }, state)
  await page.goto(`/preview/#${route}`)
}

const meta = (page: Page, name: string) => page.locator(`meta[name="${name}"]`).getAttribute('content')

test.describe('P01 the preview opens like an app', () => {
  test('P01-H1 home-screen page, not indexed, no service worker', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    expect(await meta(page, 'robots')).toBe('noindex, nofollow')
    expect(await meta(page, 'apple-mobile-web-app-capable')).toBe('yes')
    expect(await meta(page, 'apple-mobile-web-app-status-bar-style')).toBe('black-translucent')
    expect(await meta(page, 'viewport')).toContain('viewport-fit=cover')
    await expect(page.locator('meta[property^="og:"]')).toHaveCount(0)
    // The new logo, as on the website.
    const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(icon).toBe('/preview/apple-touch-icon.png')
    const res = await page.request.get(icon!)
    expect(res.headers()['content-type']).toContain('image/png')
    expect(Buffer.compare(await res.body(), readFileSync('public/apple-touch-icon.png'))).toBe(0)
    expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations())?.length ?? 0)).toBe(0)
    await a11y(page)
  })

  test('P01-H2 the strip sits above the app, which keeps clear of it', async ({ page }) => {
    await open(page)
    const strip = page.getByRole('complementary', { name: 'Pré-visualização' })
    await expect(strip).toHaveText('Pré-visualização')
    const s = (await strip.boundingBox())!
    const logo = (await page.getByRole('banner').getByRole('link', { name: 'SwingMath' }).boundingBox())!
    expect(s.y).toBe(0)
    expect(logo.y).toBeGreaterThanOrEqual(s.y + s.height)
    // It stays put when the page scrolls.
    await page.locator('#app-scroll').evaluate((el) => el.scrollTo(0, 600))
    expect((await strip.boundingBox())!.y).toBe(0)
  })

  test('P01-E1 the first launch: the walkthrough, without the reminders step', async ({ page }) => {
    await open(page, '/', {})
    await expect(page).toHaveURL(/#\/bem-vindo$/)
    await expect(page.getByRole('complementary', { name: 'Pré-visualização' })).toBeVisible()
    await page.getByRole('button', { name: 'Começar' }).click()
    await page.getByRole('radio', { name: /Pure Aero 98 \(2026\)/ }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Tensão').fill('24')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('checkbox', { name: 'Estabilidade' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    // No notifications in a browser: straight to the end.
    await expect(page.getByRole('heading', { name: 'Avisamos-te quando encordar' })).toHaveCount(0)
  })
})

test.describe('P02 routes after the #', () => {
  test('P02-H1 every tab, and a reload keeps the page', async ({ page }) => {
    await open(page)
    const tabs = page.getByRole('navigation', { name: 'Main' })
    for (const [tab, hash] of [
      ['Raquetes', '#/rackets'],
      ['Setups', '#/setups'],
      ['Diário', '#/diario'],
      ['Calcular', '#/'],
    ] as const) {
      await tabs.getByRole('link', { name: tab }).click()
      await expect(page).toHaveURL(new RegExp(`/preview/${hash.replace('/', '\\/')}$`))
    }
    await page.goto('/preview/#/perfil/definicoes')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Definições' })).toBeVisible()
  })
})

test.describe('P03 nothing native, nothing breaks', () => {
  test('P03-H1 the paywall sells nothing here', async ({ page }) => {
    await open(page, '/perfil')
    await page.getByRole('button', { name: 'Ver planos' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Compras só na app instalada.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Restaurar compras' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Restaurar compras' })).toHaveCount(0)
  })

  test('P03-H2 the export downloads the file', async ({ page }) => {
    await open(page, '/perfil/definicoes')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar cópia (JSON)' }).click()
    expect((await download).suggestedFilename()).toMatch(/\.json$/)
  })

  test('P03-H3 a shared link goes to the website, not to the preview', async ({ page }) => {
    await open(page)
    await saveSetup(page, 'Pré teste')
    await page.goto('/preview/#/setups')
    await page.getByRole('button', { name: 'Partilhar' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Copiar ligação' }).click()
    const link = await page.evaluate(() => (window as unknown as { copied: string }).copied)
    expect(link).toMatch(/^http:\/\/localhost:\d+\/s\/[\w-]+$/)
  })
})
