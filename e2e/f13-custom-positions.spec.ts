import { a11y, expect, resultCard, saveSetup, start, test } from './fixtures'

async function addPosition(page: import('@playwright/test').Page, opts: { hour?: string; one?: boolean; shaftCm?: string }) {
  await page.getByRole('button', { name: 'Adicionar posição' }).click()
  const d = page.getByRole('dialog', { name: 'Adicionar posição' })
  if (opts.shaftCm) {
    await d.getByRole('radio', { name: 'Na haste' }).click()
    await d.getByLabel('Distância do fundo do cabo').fill(opts.shaftCm)
  } else {
    await d.getByLabel('Hora').selectOption({ label: opts.hour! })
    if (opts.one) await d.getByRole('radio', { name: 'Só num lado' }).click()
  }
  await d.getByRole('button', { name: 'Adicionar posição' }).click()
  await expect(d).toBeHidden()
}

test.describe('F13 custom lead positions', () => {
  test('F13-H1 11 and 1 on both sides adds weight and shows on the drawing', async ({ page }) => {
    await start(page)
    await expect(page.getByText(/Chumbo em qualquer hora do aro/)).toBeVisible()
    await addPosition(page, { hour: '11h' })
    // New positions start at 1 g.
    await expect(page.getByRole('slider', { name: '11h e 1h' })).toHaveAttribute('aria-valuetext', '1,0 g')
    await page.getByRole('button', { name: '+ 0,5 g 11h e 1h' }).click()
    await page.getByRole('button', { name: '+ 0,5 g 11h e 1h' }).click()
    await expect(page.getByText('Chumbo total:')).toContainText('2,0 g')
    // 323 measured strung + 6 overgrip + 2
    await expect(resultCard(page)).toContainText('331,0')
    await expect(page.getByRole('button', { name: '11h e 1h: 2,0 g' }).first()).toBeVisible()
    await a11y(page)
  })

  test('F13-H2 one side only and a point on the shaft', async ({ page }) => {
    await start(page)
    await addPosition(page, { hour: '4h', one: true })
    await expect(page.getByRole('slider', { name: '4h, um lado' })).toBeVisible()
    await addPosition(page, { shaftCm: '25' })
    await expect(page.getByRole('slider', { name: 'Haste a 25 cm' })).toBeVisible()
    await expect(page.getByText('Chumbo total:')).toContainText('2,0 g')
    await page.getByRole('button', { name: 'Remover 4h, um lado' }).click()
    await expect(page.getByRole('slider', { name: '4h, um lado' })).toHaveCount(0)
    await expect(page.getByText('Chumbo total:')).toContainText('1,0 g')
  })

  test('F13-E1 custom positions survive a reload and are saved with the setup', async ({ page }) => {
    await start(page)
    await addPosition(page, { hour: '10h30' })
    await page.reload()
    await expect(page.getByRole('slider', { name: '10h30 e 1h30' })).toBeVisible()
    await saveSetup(page, 'Com 1h30')
    await page.goto('/setups')
    await expect(page.getByRole('article')).toContainText('10h30 e 1h30 1,0 g')
    await page.getByRole('button', { name: 'Ficha para o encordoador' }).click()
    await expect(page.getByRole('table').first()).toContainText('10h30 e 1h30')
  })

  test('F13-E2 6h on both sides counts once (it is a single point)', async ({ page }) => {
    await start(page)
    await addPosition(page, { hour: '6h' })
    await expect(page.getByRole('slider', { name: '6h, um lado' })).toBeVisible()
  })
})
