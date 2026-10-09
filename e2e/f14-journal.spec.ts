import { a11y, expect, resultCard, start, test } from './fixtures'
import type { Page } from '@playwright/test'

async function addStringing(page: Page, label: string) {
  await page.getByRole('button', { name: 'Encordei' }).first().click()
  const d = page.getByRole('dialog', { name: 'Encordoamento' })
  await d.getByLabel('Nome da raquete').fill(label)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
}

async function logSession(page: Page, minutes: number, overall?: number) {
  await page.getByRole('button', { name: 'Registar sessão' }).click()
  const d = page.getByRole('dialog', { name: 'Sessão' })
  await d.getByLabel('Duração').fill(String(minutes))
  if (overall) await d.getByRole('radiogroup', { name: 'Geral' }).getByRole('radio', { name: `${overall}/5` }).click()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
}

test.describe('F14 journal', () => {
  test('F14-H1 log a stringing and a session', async ({ page }) => {
    await start(page, { path: '/diario' })
    await expect(page.getByText(/Regista quando encordas/)).toBeVisible()
    await addStringing(page, 'Aero #1')
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets).toContainText('Aero #1')
    await expect(rackets).toContainText('Poli 23 kg')
    await expect(rackets.getByRole('meter', { name: 'Vida das cordas' })).toHaveAttribute('aria-valuenow', '100')
    await logSession(page, 120, 4)
    await expect(rackets).toContainText('2,0 h jogadas')
    await expect(page.getByRole('region', { name: 'Sessões' })).toContainText('Treino · 120 min · 4/5')
    // Free: the analysis is a Pro feature.
    await expect(page.getByRole('region', { name: 'O que joga melhor' }).getByRole('button', { name: 'Experimentar o Pro' })).toBeVisible()
    await a11y(page)
  })

  test('F14-H2 restring keeps the racket; Pro ranks stringings', async ({ page }) => {
    await start(page, { path: '/diario', pro: true })
    await addStringing(page, 'Blade')
    await logSession(page, 60, 3)
    await page.getByRole('button', { name: 'Encordei de novo' }).click()
    const d = page.getByRole('dialog', { name: 'Encordoamento' })
    await expect(d.getByLabel('Nome da raquete')).toHaveValue('Blade')
    await d.getByLabel('Tensão').fill('21')
    await d.getByRole('button', { name: 'Guardar' }).click()
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets.getByRole('listitem')).toHaveCount(1)
    await expect(rackets).toContainText('Poli 21 kg')
    await logSession(page, 60, 5)
    const best = page.getByRole('region', { name: 'O que joga melhor' }).getByRole('listitem')
    await expect(best).toHaveCount(2)
    await expect(best.first()).toContainText('Poli 21 kg')
  })

  test('F14-E1 strings past their life: banner and a dot on the tab', async ({ page }) => {
    await start(page, { path: '/diario' })
    await addStringing(page, 'Velha')
    await logSession(page, 600)
    await logSession(page, 600)
    await expect(page.getByRole('status').filter({ hasText: 'Velha: está na altura de encordar' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Diário \(1\)/ })).toBeVisible()
  })

  test('F14-E2 free journal shows the last 10 sessions', async ({ page }) => {
    await start(page, { path: '/diario' })
    await addStringing(page, 'X')
    for (let i = 0; i < 11; i++) await logSession(page, 30)
    await expect(page.getByRole('region', { name: 'Sessões' }).getByRole('listitem')).toHaveCount(10)
    await expect(page.getByText(/Mostramos as últimas 10 sessões/)).toBeVisible()
  })
})

test.describe('F15 strings, grip and arm comfort', () => {
  test('F15-H1 tension changes the stringbed stiffness', async ({ page }) => {
    await start(page)
    const card = page.getByRole('region', { name: 'Cordas' })
    const index = card.getByText(/^\d+$/).first()
    const before = Number(await index.textContent())
    await card.getByLabel('Tensão').fill('26')
    await expect(async () => expect(Number(await index.textContent())).toBeGreaterThan(before)).toPass()
    await expect(page.getByRole('region', { name: 'Conforto do braço' }).getByRole('meter')).toBeVisible()
  })

  test('F15-H2 a heat-shrink sleeve adds a size and its weight', async ({ page }) => {
    await start(page)
    const grip = page.getByRole('region', { name: 'Punho' })
    const weight = async () => Number((await resultCard(page).locator('.readout').first().textContent())!.replace(',', '.'))
    const before = await weight()
    await grip.getByRole('radiogroup', { name: 'Mangas termo-retráteis' }).getByRole('radio', { name: '1' }).click()
    await expect(grip).toContainText('Tamanho final: L3')
    await expect(grip).toContainText('4 3/8"')
    await expect(async () => expect(await weight()).toBeCloseTo(before + 7, 1)).toPass()
  })

  test('F15-H3 equivalent tension: Pro sees the answer, free sees the gate', async ({ page }) => {
    await start(page, { path: '/cordas' })
    await expect(page.getByRole('region', { name: 'Encorda a' }).getByRole('button', { name: 'Experimentar o Pro' })).toBeVisible()
    await a11y(page)
  })

  test('F15-H4 equivalent tension, Pro', async ({ page }) => {
    await start(page, { path: '/cordas', pro: true })
    const result = page.getByRole('region', { name: 'Encorda a' })
    // Same racket and string: same tension.
    await expect(result).toContainText('23 kg')
    await page.getByRole('region', { name: 'Para onde vais' }).getByLabel('Material').selectOption('gut')
    // Gut is softer, so it needs more tension for the same stiffness.
    await expect(result).not.toContainText(/^23 kg/)
    const kg = Number((await result.locator('.readout').first().textContent())!.replace(',', '.').replace(' kg', ''))
    expect(kg).toBeGreaterThan(23)
  })
})
