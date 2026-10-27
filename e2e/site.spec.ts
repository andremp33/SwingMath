import { a11y, expect, test } from './fixtures'
import type { Page } from '@playwright/test'

// The website (web build): the apps' shop window, the pages the stores ask
// for, and shared setups. It is not an app any more.
async function visit(page: Page, path = '/') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt' }, version: 4 }))
  })
  await page.goto(path)
}

test.describe('S01 shop window', () => {
  test('S01-H1 the front page shows the app and the stores', async ({ page }) => {
    await visit(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Afina a raquete ao grama.')
    await expect(page.getByRole('img', { name: /calculadora do SwingMath/ })).toBeVisible()
    // No store links yet: "coming soon", not a dead link.
    await expect(page.getByText('Em breve').first()).toBeVisible()
    await expect(page.getByText('App Store').first()).toBeVisible()
    await expect(page.getByText('Google Play').first()).toBeVisible()
    // Nothing of the old web app: no calculator, no prices.
    await expect(page.getByRole('link', { name: 'Abrir a calculadora' })).toHaveCount(0)
    await expect(page.getByText(/€/)).toHaveCount(0)
    await a11y(page)
  })

  test('S01-E1 in Spanish and English', async ({ page }) => {
    await visit(page)
    await page.getByRole('radio', { name: 'es' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Afina tu raqueta')
    await page.getByRole('radio', { name: 'en' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tune your racket')
  })

  test('S01-E2 the app’s old pages lead to the front page', async ({ page }) => {
    for (const path of ['/rackets', '/diario', '/perfil', '/sobre']) {
      await visit(page, path)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Afina a raquete')
    }
  })
})

test.describe('S02 the pages the stores ask for', () => {
  test('S02-H1 privacy and terms, with the site’s own section', async ({ page }) => {
    await visit(page)
    await page.getByRole('link', { name: 'Privacidade' }).click()
    await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible()
    await expect(page.getByText('Não precisas de conta para usar o SwingMath.', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Este site' })).toBeVisible()
    await expect(page.getByText('Lemon Squeezy', { exact: false })).toHaveCount(0)
    await a11y(page)
    await page.getByRole('link', { name: 'Termos' }).click()
    await expect(page.getByRole('heading', { name: 'Termos de utilização' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Teste grátis' })).toBeVisible()
    await a11y(page)
  })

  test('S02-H2 support and account deletion', async ({ page }) => {
    await visit(page)
    await page.getByRole('link', { name: 'Suporte' }).click()
    await expect(page.getByRole('heading', { name: 'Suporte', level: 1 })).toBeVisible()
    await a11y(page)
    await page.getByRole('link', { name: 'Apagar conta' }).click()
    await expect(page.getByRole('heading', { name: 'Apagar a tua conta' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Na app' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Por email' })).toBeVisible()
    await expect(page.getByText('Apagar a conta não cancela uma subscrição', { exact: false })).toBeVisible()
    await a11y(page)
  })
})

test.describe('S03 shared setups', () => {
  test('S03-H1 a shared link shows the setup and the way to the app', async ({ page }) => {
    // A setup as the app's share link carries it.
    const payload = {
      v: 1,
      setup: {
        racketId: 'stock-babolat-pure-aero-98-2026',
        name: 'Plow extra',
        baseMode: 'reference',
        measured: {},
        accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false },
        leadG: { tip: 2, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 },
        ratings: {},
      },
      racket: { id: 'stock-babolat-pure-aero-98-2026', brand: 'Babolat', model: 'Pure Aero 98', year: 2026, type: 'tweener', isStock: true, lengthCm: 68.58, headSizeSqIn: 98, weightG: 305, balanceCm: 31.5, swingweight: 295 },
    }
    const data = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await visit(page, `/s/${data}`)
    await expect(page.getByRole('heading', { name: 'Plow extra' })).toBeVisible()
    await expect(page.getByText('Babolat Pure Aero 98 (2026)')).toBeVisible()
    await expect(page.getByText('12h 2,0 g')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir na app' })).toBeVisible()
    await expect(page.getByText('Ainda não tens a app?')).toBeVisible()
    await a11y(page)
  })

  test('S03-E1 a broken link and a stringer’s sheet', async ({ page }) => {
    await visit(page, '/s/not-a-real-setup')
    await expect(page.getByText('Esta ligação não tem um setup válido.')).toBeVisible()
    await visit(page, '/ficha/abc')
    await expect(page.getByRole('heading', { name: 'Ficha para o encordoador' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir na app' })).toBeVisible()
  })
})
