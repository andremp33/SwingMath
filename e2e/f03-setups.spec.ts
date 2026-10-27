import { a11y, expect, saveSetup, setupAction, start, tapLead, test } from './fixtures'

test.describe('F03 save, name and rate a setup', () => {
  test('F03-H1 save, rate and favourite', async ({ page }) => {
    await start(page)
    await tapLead(page, '12h (ponta)')
    await saveSetup(page, 'Torneio de sábado')
    await expect(page.getByText('A editar: Torneio de sábado')).toBeVisible()

    await page.getByRole('link', { name: 'Setups' }).first().click()
    const card = page.getByRole('article').filter({ hasText: 'Torneio de sábado' })
    await expect(card).toContainText('12h 0,5 g')
    await setupAction(page, 'Torneio de sábado', 'Editar')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radiogroup', { name: 'Serviço' }).getByRole('radio', { name: '4/5' }).click()
    await dialog.getByRole('switch', { name: 'Favorito' }).click()
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(card.getByRole('button', { name: 'Favorito' })).toHaveAttribute('aria-pressed', 'true')
    await expect(card.getByText('4/5')).toBeAttached()
    await a11y(page)
  })

  test('F03-E1 empty name gets a default', async ({ page }) => {
    await start(page)
    await saveSetup(page, '')
    await expect(page.getByText('A editar: Setup 1')).toBeVisible()
  })

  test('F03-E2 accents, emoji and long names', async ({ page }) => {
    await start(page)
    const long = 'Ação 🎾 '.repeat(12)
    await saveSetup(page, long)
    await page.goto('/setups')
    // Field max length is 60, so the name is cut, never rejected.
    await expect(page.getByRole('heading', { name: /^Ação 🎾/ })).toBeVisible()
  })

  test('F03-E3 updating a loaded setup keeps one copy', async ({ page }) => {
    await start(page)
    await saveSetup(page, 'Base')
    await tapLead(page, 'Cabo')
    await page.getByRole('button', { name: 'Atualizar setup' }).click()
    await expect(page.getByText('Setup atualizado')).toBeVisible()
    await page.goto('/setups')
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('article')).toContainText('Cabo 0,5 g')
  })

  test('F03-N1 up to five setups free, with no paywall', async ({ page }) => {
    await start(page)
    for (let i = 1; i <= 4; i++) await saveSetup(page, `S${i}`)
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
    await page.goto('/setups')
    await expect(page.getByRole('article')).toHaveCount(4)
  })

  test('F03-N2 delete with undo', async ({ page }) => {
    await start(page)
    await saveSetup(page, 'Apagar-me')
    await page.goto('/setups')
    await setupAction(page, 'Apagar-me', 'Apagar')
    await expect(page.getByRole('article')).toHaveCount(0)
    await page.getByRole('button', { name: 'Anular' }).click()
    await expect(page.getByRole('article')).toHaveCount(1)
  })

  test('F03-E4 empty list explains what to do', async ({ page }) => {
    await start(page, { path: '/setups' })
    await expect(page.getByText('Ainda não guardaste nenhum setup.')).toBeVisible()
    await a11y(page)
  })
})

test.describe('F04 compare two setups', () => {
  test('F04-H1 side by side', async ({ page }) => {
    await start(page)
    await saveSetup(page, 'Leve')
    await tapLead(page, '12h (ponta)')
    await tapLead(page, '12h (ponta)')
    await saveSetup(page, 'Pesada')
    await page.goto('/setups')
    await expect(page.getByRole('article')).toHaveCount(2)
    // Compare mode: a box on each card, then the bar at the bottom.
    await page.getByRole('button', { name: 'Comparar', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Selecionar Pesada' }).check()
    await page.getByRole('checkbox', { name: 'Selecionar Leve' }).check()
    await page.getByRole('region', { name: 'Comparar' }).getByRole('button', { name: 'Comparar' }).click()
    await expect(page.getByRole('heading', { name: 'Comparar setups' })).toBeVisible()
    await expect(page.getByRole('table')).toContainText('Leve')
    await expect(page.getByRole('table')).toContainText('Pesada')
    // Columns follow the pick order (Pesada, then Leve): 2 − 1 = Leve − Pesada, 1 g lighter.
    await expect(page.getByRole('row', { name: /^Peso/ }).getByRole('cell').nth(2)).toHaveText(/^↓\s*menos\s*1,0$/)
    await a11y(page)
  })

  test('F04-E1 with fewer than two picked, explain', async ({ page }) => {
    await start(page, { path: '/setups/compare' })
    await expect(page.getByText('Escolhe dois setups na lista')).toBeVisible()
  })
})
