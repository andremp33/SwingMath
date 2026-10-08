import { a11y, expect, saveSetup, start, test } from './fixtures'

test.describe('F05 share a setup', () => {
  test('F05-H1 link opens the setup and saves it', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
    await saveSetup(page, 'Partilhado')
    await page.goto('/setups')
    await page.getByRole('button', { name: 'Partilhar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Partilhar setup' })
    await expect(dialog.getByRole('img', { name: 'Partilhado' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Copiar ligação' }).click()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toMatch(/\/s\/[\w-]+$/)

    // Someone else opens it: a fresh context with no data.
    const other = await context.browser()!.newContext({ locale: 'pt-PT' })
    const p2 = await other.newPage()
    await p2.addInitScript(() => localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt' }, version: 1 })))
    await p2.goto(link)
    await expect(p2.getByRole('heading', { name: 'Partilhado', exact: true })).toBeVisible()
    await expect(p2.getByText('3/9h 0,5 g')).toBeVisible()
    await a11y(p2)
    await p2.getByRole('button', { name: 'Guardar nos meus setups' }).click()
    await expect(p2.getByRole('heading', { name: 'Partilhado', exact: true })).toBeVisible()
    await expect(p2).toHaveURL(/\/setups$/)
    await other.close()
  })

  test('F05-N1 broken link shows a clear message', async ({ page }) => {
    await start(page, { path: '/s/not-a-real-setup' })
    await expect(page.getByText('Esta ligação de setup não é válida.')).toBeVisible()
  })
})
