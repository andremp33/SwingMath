import { a11y, expect, test } from './fixtures'
import type { Page } from '@playwright/test'

// The store app's first launch (app build's mode, a fresh phone).
async function firstLaunch(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt' }, version: 4 }))
    // A phone that has not been asked about notifications yet (headless
    // Chromium says they are blocked).
    Object.defineProperty(Notification, 'permission', { get: () => 'default' })
  })
  await page.goto('/')
}

test.describe('A01 first launch', () => {
  test('A01-H1 the first launch shows the walkthrough', async ({ page }) => {
    await firstLaunch(page)
    await expect(page).toHaveURL(/\/bem-vindo$/)
    await expect(page.getByRole('heading', { name: 'Vê o que cada grama faz à tua raquete' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Já tenho conta' })).toBeVisible()
    await a11y(page)
  })

  test('A01-E1 skipping it leads to the calculator, for good', async ({ page }) => {
    await firstLaunch(page)
    await page.getByRole('button', { name: 'Saltar' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await expect(page).not.toHaveURL(/bem-vindo/)
  })

  test('A01-H2 finishing it makes the rackets and their stringing', async ({ page }) => {
    await firstLaunch(page)
    await page.getByRole('button', { name: 'Começar' }).click()

    // The racket: a popular one, two of them.
    await expect(page.getByText('Passo 1 de 4')).toBeVisible()
    await page.getByRole('radio', { name: /Pure Aero 98 \(2026\)/ }).click()
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Pure Aero 98 #1')
    await page.getByRole('radio', { name: '2', exact: true }).click()
    await a11y(page)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // The strings.
    await page.getByLabel('Tensão').fill('24')
    await page.getByRole('radio', { name: 'Há 1 semana' }).click()
    await page.getByRole('radio', { name: '3–4 h' }).click()
    // Let the chips finish their colour change before measuring contrast.
    await page.waitForTimeout(300)
    await a11y(page)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // What to improve.
    await page.getByRole('checkbox', { name: 'Estabilidade' }).click()
    await page.getByRole('radio', { name: 'Avançado' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Reminders: asked before the system's dialog, with "not now" in sight.
    await expect(page.getByRole('heading', { name: 'Avisamos-te quando encordar' })).toBeVisible()
    await page.getByRole('button', { name: 'Agora não' }).click()

    // The end: the racket, its strings, when to restring; no prices.
    await expect(page.getByRole('heading', { name: 'Está tudo pronto' })).toBeVisible()
    await expect(page.getByText('Pure Aero 98 #1')).toBeVisible()
    await expect(page.getByText(/Poli 24 kg · encordar daqui a ~\d+ dias/)).toBeVisible()
    await expect(page.getByText(/€/)).toHaveCount(0)
    await a11y(page)
    await page.getByRole('button', { name: 'Abrir na calculadora' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await expect(page.getByText('Dica: 2 a 4 g às 3h e 9h dão mais estabilidade.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pure Aero 98 #1' })).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/diario')
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets).toContainText('Pure Aero 98 #1')
    await expect(rackets).toContainText('Pure Aero 98 #2')
    await expect(rackets).toContainText('Poli 24 kg')
  })
})
