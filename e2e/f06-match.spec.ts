import { a11y, expect, start, test } from './fixtures'

test.describe('F06 hit a target', () => {
  test('F06-H1 finds lead to reach a target', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    const target = page.getByRole('region', { name: 'Alvo', exact: true })
    await target.getByLabel('Peso', { exact: true }).fill('320')
    await target.getByLabel('Swingweight').fill('300')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    const plan = page.getByRole('region', { name: 'Onde pôr o chumbo' })
    await expect(plan).toContainText('Chumbo total')
    await expect(plan).toContainText(/9\d(,\d)?% de correspondência|100% de correspondência/)
    await a11y(page)
  })

  test('F06-E1 target lighter than the frame is flagged', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('region', { name: 'Alvo', exact: true }).getByLabel('Peso', { exact: true }).fill('290')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByText(/Não dá para chegar a este alvo/)).toBeVisible()
  })

  test('F06-N1 empty target asks for a value', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Preenche pelo menos um valor do alvo.')
  })

  test('FIX-5 free users get 3 runs, then the Pro sheet', async ({ page }) => {
    await start(page, { path: '/match' })
    await expect(page.getByRole('radio', { name: /Atingir um alvo/ })).toContainText('3 grátis')
    await page.getByRole('region', { name: 'Alvo', exact: true }).getByLabel('Peso', { exact: true }).fill('320')
    const run = page.getByRole('button', { name: 'Calcular', exact: true })
    for (let i = 0; i < 3; i++) {
      await run.click()
      await expect(page.getByRole('region', { name: 'Onde pôr o chumbo' })).toBeVisible()
    }
    await run.click()
    const sheet = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('3 de 3 cálculos grátis usados')
  })

  test('F06-E2 open the plan in the calculator', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('region', { name: 'Alvo', exact: true }).getByLabel('Peso', { exact: true }).fill('315')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir na calculadora' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    // The frame starts at 306 g unstrung, so 315 g needs 9 g of lead.
    await expect(page.getByText('Chumbo total:')).toContainText('9,0 g')
  })
})

test.describe('F07 match rackets', () => {
  test('F07-H1 two rackets get a common target', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
    for (const q of ['speed mp', 'radical mp']) {
      await page.getByRole('button', { name: 'Raquete Procurar marca ou modelo' }).first().click()
      await page.getByRole('dialog').getByRole('searchbox').fill(q)
      await page.getByRole('dialog').getByRole('listitem').first().getByRole('button').click()
    }
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Alvo comum' })).toBeVisible()
    await expect(page.getByRole('region', { name: /Raquete [12]/ }).filter({ hasText: 'Chumbo total' })).toHaveCount(2)
    await a11y(page)
  })

  test('F07-N1 missing racket shows an error', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('Pro targets', () => {
  test('F06-H5 a pro target, converted to the state of the starting point, with its source', async ({ page }) => {
    await start(page, { path: '/match' })
    const to = page.getByRole('region', { name: 'Alvo', exact: true })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await to.getByRole('radio', { name: /Rafael Nadal/ }).click()
    // Library values are unstrung, so Nadal's strung 337 g loses the 17 g of strings.
    await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('320')
    await expect(to).toContainText('Medida com cordas; convertemos para sem cordas')
    await expect(to.getByRole('link', { name: 'Fonte: Tennis Warehouse' })).toHaveAttribute('href', /BARORreview/)
    await a11y(page)
  })

  test('F06-H6 from the calculator with strings on, the target stays strung', async ({ page }) => {
    await start(page, { path: '/match' })
    await page.getByRole('button', { name: 'Da calculadora' }).click()
    const to = page.getByRole('region', { name: 'Alvo', exact: true })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await to.getByRole('radio', { name: /Roger Federer/ }).click()
    await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('357')
    await expect(to).toContainText('Valores com cordas.')
  })
})
