import { a11y, expect, test } from './fixtures'
import type { Page } from '@playwright/test'

// The store app, past its first launch.
async function open(page: Page, path = '/') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt', onboarded: true }, version: 4 }))
  })
  await page.goto(path)
}

test.describe('A02 profile', () => {
  test('A02-H1 the avatar opens the profile', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await page.getByRole('link', { name: 'Perfil' }).click()
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByText('Sem conta: os dados ficam neste telemóvel.')).toBeVisible()
    for (const h of ['O teu jogo', 'As minhas raquetes', 'Plano', 'Definições', 'Ajuda e legal']) await expect(page.getByRole('heading', { name: h })).toBeVisible()
    // Free: see the plans, or restore what was bought before.
    await expect(page.getByRole('button', { name: 'Ver planos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restaurar compras' })).toBeVisible()
    await a11y(page)
  })

  test('A02-H2 the game is edited in place and kept', async ({ page }) => {
    await open(page, '/perfil')
    await page.getByRole('checkbox', { name: 'Conforto' }).click()
    await page.getByRole('radio', { name: 'Rede' }).click()
    await page.getByRole('radio', { name: 'Esquerda' }).click()
    await page.getByLabel('Horas de jogo por semana').fill('4')
    await page.getByLabel('Horas de jogo por semana').blur()
    await page.reload()
    await expect(page.getByRole('checkbox', { name: 'Conforto' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Rede' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Esquerda' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Horas de jogo por semana')).toHaveValue('4')
  })

  test('A02-H3 each racket shows its strings and when to restring, and logs a restring', async ({ page }) => {
    await open(page, '/diario')
    await page.getByRole('button', { name: 'Nova raquete' }).first().click()
    const d = page.getByRole('dialog', { name: 'Nova raquete' })
    await d.getByLabel('Nome', { exact: true }).fill('Aero #1')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()
    await page.goto('/perfil')
    const rackets = page.getByRole('region', { name: 'As minhas raquetes' })
    await expect(rackets).toContainText('Aero #1')
    await expect(rackets).toContainText(/Poli 23 kg · encordar a \d/)
    await rackets.getByRole('button', { name: 'Encordei hoje: Aero #1' }).click()
    await expect(page.getByText('Aero #1: encordamento registado')).toBeVisible()
  })

  test('A02-H4 settings are a subpage, with a way back', async ({ page }) => {
    await open(page, '/perfil')
    await page.getByRole('link', { name: /Idioma, tema/ }).click()
    await expect(page.getByRole('heading', { name: 'Definições' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'English' })).toBeVisible()
    await a11y(page)
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/perfil$/)
    // Old links land on the subpage.
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/perfil\/definicoes$/)
  })
})
