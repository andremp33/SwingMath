import { a11y, expect, start, test } from './fixtures'

test.describe('F08 library and custom rackets', () => {
  test('F08-H1 search and filter', async ({ page }) => {
    await start(page, { path: '/rackets' })
    await page.getByLabel('Procurar marca ou modelo').fill('ezone')
    // EZONE 98 and 100 (2025), EZONE 98, 100 and 98 Tour (2022)
    await expect(page.getByRole('article')).toHaveCount(5)
    await page.getByLabel('Procurar marca ou modelo').fill('')
    await page.getByLabel('Marca', { exact: true }).selectOption('Wilson')
    await expect(page.getByRole('article').first()).toContainText('Wilson')
    await a11y(page)
  })

  test('F08-E1 no results offers to clear filters', async ({ page }) => {
    await start(page, { path: '/rackets' })
    await page.getByLabel('Procurar marca ou modelo').fill('zzzz')
    await expect(page.getByText('Nenhuma raquete encontrada.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByRole('article').first()).toBeVisible()
  })

  test('F08-H2 add, edit and delete a custom racket (Pro)', async ({ page }) => {
    await start(page, { pro: true, path: '/rackets' })
    await page.getByRole('button', { name: 'Nova raquete' }).click()
    await expect(page.getByRole('heading', { name: 'Nova raquete' })).toBeVisible()
    await page.getByLabel('Marca', { exact: true }).fill('Oficina')
    await page.getByLabel('Modelo', { exact: true }).fill('Protótipo 1')
    await page.getByLabel('Peso', { exact: true }).fill('318')
    await page.getByLabel('Equilíbrio', { exact: true }).fill('322')
    await page.getByLabel('Swingweight', { exact: true }).fill('295')
    await page.getByRole('button', { name: 'Guardar' }).click()
    const card = page.getByRole('article').filter({ hasText: 'Protótipo 1' })
    await expect(card).toContainText('Minha')
    await card.getByRole('button', { name: 'Editar' }).click()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Apagar' }).click()
    await expect(page.getByRole('article').filter({ hasText: 'Protótipo 1' })).toHaveCount(0)
  })

  test('F08-N1 required fields are checked', async ({ page }) => {
    await start(page, { pro: true, path: '/rackets/new' })
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Verifica os campos assinalados.')).toBeVisible()
    await expect(page.getByText('Obrigatório').first()).toBeVisible()
    await a11y(page)
  })

  test('FIX-2 free users can add their own racket', async ({ page }) => {
    await start(page, { path: '/rackets' })
    await page.getByRole('button', { name: 'Nova raquete' }).click()
    await expect(page.getByRole('heading', { name: 'Nova raquete' })).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('F09 Pro and settings', () => {
  test('F09-E1 without a store, the sheet says so', async ({ page }) => {
    await start(page, { path: '/settings' })
    await expect(page.getByText('A loja ainda não está configurada nesta versão.')).toBeVisible()
    await a11y(page)
  })

  test('F09-E2 language and theme', async ({ page }) => {
    await start(page, { path: '/settings' })
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await a11y(page)
  })

  test('F09-E3 export a backup', async ({ page }) => {
    await start(page, { path: '/settings' })
    const dl = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar cópia (JSON)' }).click()
    expect((await dl).suggestedFilename()).toMatch(/^swingmath-\d{4}-\d{2}-\d{2}\.json$/)
  })

  test('FIX-4 Spanish interface', async ({ page }) => {
    await start(page, { path: '/settings' })
    await page.getByRole('radio', { name: 'Español' }).click()
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Resultado' })).toContainText('Punto dulce')
    await a11y(page)
  })

  test('F09-E4 unknown page', async ({ page }) => {
    await start(page, { path: '/nada' })
    await expect(page.getByText('Não encontrado')).toBeVisible()
  })
})
