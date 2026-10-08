import { a11y, expect, resultCard, start, test } from './fixtures'

test.describe('F01 see the effect of adding lead', () => {
  test('F01-H1 lead at the tip raises weight and swingweight', async ({ page }) => {
    await start(page)
    // Default: Pure Aero 98 2026, measured strung 323 g, + overgrip 6 = 329 g.
    await expect(resultCard(page)).toContainText('329,0')
    const plus = page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' })
    for (let i = 0; i < 4; i++) await plus.click()
    await expect(page.getByText('Chumbo total:')).toContainText('2,0 g')
    await expect(resultCard(page)).toContainText('331,0')
    // vs the unstrung frame (306 g): strings 17 + overgrip 6 + lead 2.
    await expect(resultCard(page)).toContainText('+25,0')
    await a11y(page)
  })

  test('F01-E1 slider stops at 20 g and the plus button disables', async ({ page }) => {
    await start(page)
    const slider = page.getByRole('slider', { name: 'Cabo' })
    await slider.fill('20')
    await expect(page.getByRole('button', { name: '+ 0,5 g Cabo' })).toBeDisabled()
    await expect(slider).toHaveAttribute('aria-valuetext', '20,0 g')
  })

  test('F01-E2 keyboard only: arrows move the slider', async ({ page }) => {
    await start(page)
    const slider = page.getByRole('slider', { name: '3h e 9h' })
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAttribute('aria-valuetext', '1,0 g')
  })

  test('F01-E3 refresh keeps the work in progress', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g Garganta' }).click()
    await page.reload()
    await expect(page.getByRole('slider', { name: 'Garganta' })).toHaveAttribute('aria-valuetext', '0,5 g')
  })

  test('F01-E4 clear resets lead and accessories', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await page.getByRole('switch', { name: /Antivibrador/ }).click()
    await page.getByRole('button', { name: 'Limpar alterações' }).click()
    await expect(page.getByText('Chumbo total:')).toContainText('0,0 g')
    await expect(page.getByRole('switch', { name: /Antivibrador/ })).toHaveAttribute('aria-checked', 'false')
  })

  test('F01-E5 tapping the diagram selects a position', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: /^Cabo: 0,0 g$/ }).click()
    await expect(page.getByRole('slider', { name: 'Cabo' })).toBeFocused()
  })

  test('F01-E6 changing racket recalculates', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: /Raquete Babolat Pure Aero 98/ }).first().click()
    await page.getByRole('dialog').getByRole('searchbox').fill('prestige')
    await page.getByRole('dialog').getByRole('button', { name: /Prestige MP/ }).click()
    // 320 + 16 + 6
    // Prestige MP: measured strung 326 g + overgrip 6
    await expect(resultCard(page)).toContainText('332,0')
  })

  test('F01-E7 info sheet opens and closes with Escape', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Como calculamos' }).click()
    await expect(page.getByRole('dialog', { name: 'Como calculamos' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('Fixes from user reviews', () => {
  test('FIX-3 sweet spot moves up with lead at the tip', async ({ page }) => {
    await start(page)
    const row = resultCard(page).locator('div').filter({ hasText: /^Ponto doce/ })
    await expect(row).toContainText('do fundo do cabo')
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await expect(row).toContainText('+')
  })

  test('FIX-1 check the prediction against my measurement', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Confirmar com a minha medição' }).click()
    const card = page.getByRole('region', { name: 'Confirmar com a minha medição' })
    await card.getByLabel('Peso', { exact: true }).fill('329,5')
    await expect(card.getByRole('status')).toHaveText('Dentro da tolerância')
    await card.getByLabel('Peso', { exact: true }).fill('331')
    await expect(card.getByRole('status')).toContainText('Fora da tolerância')
    await a11y(page)
  })
})

test.describe('F02 use my own measured specs', () => {
  test('F02-H1 measured weight with a decimal comma', async ({ page }) => {
    await start(page)
    await page.getByRole('radio', { name: 'As minhas medições' }).click()
    await page.getByLabel('Peso', { exact: true }).fill('322,5')
    // 322,5 + strings 17 + overgrip 6
    await expect(resultCard(page)).toContainText('345,5')
  })

  test('F02-N1 text and out-of-range values show an error and are ignored', async ({ page }) => {
    await start(page)
    await page.getByRole('radio', { name: 'As minhas medições' }).click()
    const w = page.getByLabel('Peso', { exact: true })
    await w.fill('abc')
    await w.blur()
    await expect(page.getByRole('alert')).toHaveText('Introduz um número')
    await w.fill('900')
    await expect(page.getByRole('alert')).toContainText('Entre 150 e 450')
    await expect(resultCard(page)).toContainText('329,0')
  })

  test('F02-E1 blank fields fall back to the reference', async ({ page }) => {
    await start(page)
    await page.getByRole('radio', { name: 'As minhas medições' }).click()
    await expect(resultCard(page)).toContainText('329,0')
    await a11y(page)
  })
})
