import { a11y, expect, start, test } from './fixtures'

test.describe('F10 site pages', () => {
  test('F10-H1 landing page leads to the calculator', async ({ page }) => {
    await start(page, { path: '/sobre' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Personaliza a tua raquete com números em que podes confiar.')
    await expect(page.getByRole('img', { name: /calculadora do SwingMath/ })).toBeVisible()
    await a11y(page)
    await page.getByRole('link', { name: 'Abrir a calculadora' }).first().click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
  })

  test('F10-E1 landing in Spanish and English', async ({ page }) => {
    await start(page, { path: '/sobre' })
    await page.getByRole('radio', { name: 'es' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Personaliza tu raqueta')
    await page.getByRole('radio', { name: 'en' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Customise your racket')
  })

  test('F10-H2 privacy and terms pages', async ({ page }) => {
    await start(page, { path: '/sobre' })
    await page.getByRole('link', { name: 'Privacidade' }).click()
    await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible()
    await expect(page.getByText('Não precisas de conta para usar o SwingMath.', { exact: false })).toBeVisible()
    // The website's copy adds what the site itself does.
    await expect(page.getByRole('heading', { name: 'Este site' })).toBeVisible()
    await expect(page.getByText('Lemon Squeezy', { exact: false })).toHaveCount(0)
    await a11y(page)
    await page.getByRole('link', { name: 'Termos' }).click()
    await expect(page.getByRole('heading', { name: 'Termos de utilização' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Teste grátis' })).toBeVisible()
    await a11y(page)
  })
})
