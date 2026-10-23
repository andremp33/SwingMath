import { a11y, expect, start, test } from './fixtures'
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
    // By name, from the catalogue: the material comes with it.
    await page.getByRole('combobox', { name: 'Corda' }).fill('rpm bl')
    await page.getByRole('option', { name: 'Babolat RPM Blast', exact: true }).click()
    await page.getByLabel('Calibre').selectOption('1.25')
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
    await expect(page.getByText(/RPM Blast 1,25 · 24 kg · encordar daqui a ~\d+ dias/)).toBeVisible()
    await expect(page.getByText(/€/)).toHaveCount(0)
    await a11y(page)
    await page.getByRole('button', { name: 'Abrir na calculadora' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await expect(page.getByText('Dica: 2 a 4 g às 3h e 9h dão mais estabilidade.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pure Aero 98 #1', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/diario')
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets).toContainText('Pure Aero 98 #1')
    await expect(rackets).toContainText('Pure Aero 98 #2')
    await expect(rackets).toContainText('RPM Blast 1,25 · 24 kg')
  })
})

const DAY = 86_400_000
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('swingmath')!).state as { freeProUntil: number | null; freeProEndTold: boolean })

test.describe('A02 Pro free until the next restring', () => {
  test('A02-H1 finishing the walkthrough unlocks Pro until the strings’ predicted restring', async ({ page }) => {
    await firstLaunch(page)
    await page.getByRole('button', { name: 'Começar' }).click()
    await page.getByRole('radio', { name: /Pure Aero 98 \(2026\)/ }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('radio', { name: 'Há 1 semana' }).click()
    await page.getByRole('radio', { name: '3–4 h' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Agora não' }).click()
    const note = page.getByTestId('free-pro')
    await expect(note).toHaveText(/^Desbloqueámos o Pro até .+\. Não pagas nada e não renova\.$/)
    const date = (await note.textContent())!.match(/até (.+)\. Não/)![1]
    await a11y(page)
    await page.getByRole('button', { name: 'Abrir na calculadora' }).click()
    const { freeProUntil } = await stored(page)
    // Between 14 and 30 days, by the strings put in a week ago.
    expect(freeProUntil! - Date.now()).toBeGreaterThan(13.9 * DAY)
    expect(freeProUntil! - Date.now()).toBeLessThan(30.1 * DAY)
    await page.goto('/perfil')
    const plan = page.getByRole('region', { name: 'Plano' })
    await expect(plan).toContainText(`Pro grátis até ${date}`)
    await expect(plan).toContainText('Não pagas nada e não renova.')
    // Pro views are open; the plans are still for sale.
    await page.goto('/diario')
    await expect(page.getByRole('region', { name: 'O que joga melhor' }).getByRole('button', { name: 'Experimentar o Pro' })).toHaveCount(0)
  })

  test('A02-E1 skipping the walkthrough still gives it: 14 days without strings', async ({ page }) => {
    await firstLaunch(page)
    await page.getByRole('button', { name: 'Saltar' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    const { freeProUntil } = await stored(page)
    expect(Math.abs(freeProUntil! - (Date.now() + 14 * DAY))).toBeLessThan(60_000)
  })

  test('A02-H2 once it ends: the paywall on their own report, once; nothing of theirs hidden', async ({ page }) => {
    await start(page, { path: '/diario' })
    await page.evaluate(async (DAY) => {
      const dbUrl = '/src/data/db.ts'
      const racketsUrl = '/src/data/rackets.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const { STOCK_RACKETS } = await import(/* @vite-ignore */ racketsUrl)
      const now = Date.now()
      await db.owned.put({ id: 'o1', name: 'Aero', racketId: STOCK_RACKETS[0].id, createdAt: 1, updatedAt: 2 })
      await db.stringings.put({ id: 's1', ownedId: 'o1', label: 'Aero', racketId: STOCK_RACKETS[0].id, date: now - 20 * DAY, bed: { mains: { material: 'poly', tensionKg: 23 } }, createdAt: 1, updatedAt: 2 })
      await db.sessions.put({ id: 'x1', date: now - 5 * DAY, minutes: 120, kind: 'practice', stringingId: 's1', ratings: { overall: 4 }, createdAt: 1, updatedAt: 2 })
      // The free days ended while the app was closed.
      const saved = JSON.parse(localStorage.getItem('swingmath')!)
      saved.state.freeProUntil = now - 1000
      localStorage.setItem('swingmath', JSON.stringify(saved))
    }, DAY)
    await page.reload()
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d).toContainText('O teu Pro grátis terminou.')
    await expect(d.getByRole('heading', { name: 'Descobre o que joga melhor' })).toBeVisible()
    await expect(d.getByTestId('teaser-number')).toHaveText('Vai em 2,0 h de jogo')
    await d.getByRole('button', { name: 'Fechar' }).click()
    // Their racket and sessions are where they were; only the Pro views lock again.
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero')
    await expect(page.getByRole('region', { name: 'Sessões' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'O que joga melhor' }).getByRole('button', { name: 'Experimentar o Pro' })).toBeVisible()
    expect((await stored(page)).freeProEndTold).toBe(true)
    // Once.
    await page.reload()
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero')
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
  })
})
