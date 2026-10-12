import { expect, start, test } from './fixtures'
import type { Page } from '@playwright/test'

/** Elements sticking out past the screen's edges (what makes a phone scroll sideways). */
async function sticksOut(page: Page) {
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (!r.width || el.closest('.sr-only')) continue
      if (el.parentElement && /auto|scroll/.test(getComputedStyle(el.parentElement).overflowX)) continue
      if (r.right > vw + 0.5 || r.left < -0.5) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`)
    }
    return out.slice(0, 5)
  })
}

test.describe('F16 phones never scroll sideways', () => {
  test.use({ viewport: { width: 360, height: 760 } })

  for (const path of ['/', '/rackets', '/rackets/new', '/setups', '/diario', '/match', '/cordas', '/medir', '/settings', '/sobre']) {
    test(`F16 ${path}`, async ({ page }) => {
      await start(page, { path })
      expect(await sticksOut(page)).toEqual([])
    })
  }

  test('F16 calculator after saving a setup with a long name', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await page.getByRole('button', { name: 'Guardar setup' }).click()
    await page.getByRole('dialog').getByLabel('Nome do setup').fill('Mais estabilidade e potência no serviço')
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('A editar:', { exact: false })).toBeVisible()
    expect(await sticksOut(page)).toEqual([])
  })
})
