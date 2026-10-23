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
    await page.getByRole('link', { name: 'Perfil', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByText('Dados neste telemóvel')).toBeVisible()
    for (const h of ['O teu jogo', 'As minhas raquetes', 'Plano', 'Mais']) await expect(page.getByRole('heading', { name: h })).toBeVisible()
    // The journal at a glance: rackets, hours lately, the next restring.
    await expect(page.getByRole('link', { name: /^\S+ (Raquetes|Horas · 8 semanas|Encordar)$/ })).toHaveCount(3)
    // Free: see the plans, or restore what was bought before.
    await expect(page.getByRole('button', { name: 'Ver planos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restaurar compras' })).toBeVisible()
    await a11y(page)
  })

  test('A02-H2 the game is edited in a sheet and kept', async ({ page }) => {
    await open(page, '/perfil')
    await page.getByRole('button', { name: 'Definir o meu jogo' }).click()
    const d = page.getByRole('dialog', { name: 'O teu jogo' })
    await d.getByRole('checkbox', { name: 'Conforto' }).click()
    await d.getByRole('radio', { name: 'Intermédio' }).click()
    await d.getByRole('radio', { name: 'Rede' }).click()
    await d.getByLabel('Horas de jogo por semana').fill('4')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()
    await page.reload()
    const game = page.getByRole('region', { name: 'O teu jogo' })
    await expect(game.getByRole('list', { name: 'O que queres melhorar' })).toHaveText('Conforto')
    await expect(game).toContainText('Intermédio · Rede · 4 h por semana')
    // Cancelling leaves it as it was.
    await game.getByRole('button', { name: 'Editar' }).click()
    await d.getByRole('checkbox', { name: 'Spin' }).click()
    await d.getByRole('button', { name: 'Cancelar' }).click()
    await expect(game.getByRole('list', { name: 'O que queres melhorar' })).toHaveText('Conforto')
  })

  test('A02-H5 the goals steer the calculator', async ({ page }) => {
    await open(page, '/')
    const card = page.getByRole('region', { name: 'Os teus objetivos' })
    // Cards open on wide screens, closed on phones.
    const toggle = card.getByRole('button', { name: /^Os teus objetivos/ })
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    await card.getByRole('link', { name: 'Escolher no perfil' }).click()
    await page.getByRole('button', { name: 'Definir o meu jogo' }).click()
    const d = page.getByRole('dialog', { name: 'O teu jogo' })
    await d.getByRole('checkbox', { name: 'Conforto' }).click()
    await d.getByRole('radio', { name: 'Intermédio' }).click()
    await d.getByRole('button', { name: 'Guardar' }).click()
    await page.getByRole('link', { name: 'Calcular' }).click()
    // Less tension is kinder to the arm: one tap sets it.
    await expect(card).toContainText('−2 kg de tensão')
    await expect(card).toContainText(/Swingweight \d+: .+ para intermédio/)
    await card.getByRole('button', { name: 'Aplicar' }).click()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('swingmath')!).state.config.strings.mains.tensionKg)).toBe(21)
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
    await expect(page.getByText('Aero #1: encordoamento registado')).toBeVisible()
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
