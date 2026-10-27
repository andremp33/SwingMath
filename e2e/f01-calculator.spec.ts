import { a11y, expand, expect, resultCard, start, tapLead, test } from './fixtures'

test.describe('F01 see the effect of adding lead', () => {
  test('F01-H1 lead at the tip raises weight and swingweight', async ({ page }) => {
    await start(page)
    // Default: Pure Aero 98 2026, Babolat's 305 g + strings 17 + overgrip 6 = 328 g.
    await expect(resultCard(page)).toContainText('328')
    const plus = page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' })
    for (let i = 0; i < 4; i++) await plus.click()
    await expect(page.getByText('Chumbo total:')).toContainText('2,0 g')
    await expect(resultCard(page)).toContainText('330')
    // Counted from the racket as you play it, so the change is the lead alone.
    await expect(resultCard(page)).toContainText('+2,0')
    await a11y(page)
  })

  test('F01-E1 the spot stops at 20 g and the plus button disables', async ({ page }) => {
    await start(page)
    const slider = page.getByRole('slider', { name: 'Cabo' })
    await slider.focus()
    await page.keyboard.press('End')
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
    await tapLead(page, 'Garganta')
    await page.reload()
    await expect(page.getByRole('slider', { name: 'Garganta' })).toHaveAttribute('aria-valuetext', '0,5 g')
  })

  test('F01-E4 clear resets lead and accessories', async ({ page }) => {
    await start(page)
    await tapLead(page, '12h (ponta)')
    await page.getByRole('button', { name: /^Com cordas e overgrip/ }).click()
    await page.getByRole('switch', { name: /Antivibrador/ }).click()
    await page.getByRole('button', { name: 'Limpar alterações' }).click()
    await expect(page.getByText('Chumbo total:')).toContainText('0,0 g')
    await expect(page.getByRole('switch', { name: /Antivibrador/ })).toHaveAttribute('aria-checked', 'false')
  })

  test('F01-E5 tapping the racket picks a position, with − and + beside it', async ({ page }) => {
    await start(page)
    await page.getByRole('slider', { name: 'Cabo' }).click()
    await expect(page.getByRole('slider', { name: 'Cabo' })).toBeFocused()
    await expect(page.getByRole('button', { name: '+ 0,5 g Cabo' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ 0,5 g Garganta' })).toHaveCount(0)
  })

  test('F01-E6 changing racket recalculates', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: /Raquete Babolat Pure Aero 98/ }).first().click()
    await page.getByRole('dialog').getByRole('searchbox').fill('prestige')
    await page.getByRole('dialog').getByRole('button', { name: 'Head Prestige MP (2023)' }).click()
    // Prestige MP 2023: Head's 310 g + strings 17 + overgrip 6
    await expect(resultCard(page)).toContainText('333')
  })

  test('F01-E7 info sheet opens and closes with Escape', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Como calculamos' }).click()
    await expect(page.getByRole('dialog', { name: 'Como calculamos' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('Sweet spot', () => {
  test('SS-H1 lead at 4 and 8 lowers the sweet spot', async ({ page }) => {
    await start(page)
    await expand(page, 'Ponto doce')
    const card = page.getByRole('region', { name: 'Ponto doce' })
    // Above it raises it, below it lowers it.
    await expect(card.getByRole('listitem').filter({ hasText: '12h (ponta)' })).toContainText('+')
    await expect(card.getByRole('listitem').filter({ hasText: '4h e 8h' })).toContainText('−')
    await card.getByRole('button', { name: 'Adicionar' }).click()
    const slider = page.getByRole('slider', { name: '4h e 8h' })
    await expect(slider).toBeFocused()
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight')
    await expect(card).toContainText(/O teu chumbo moveu-o [\d,]+ mm para baixo/)
    await expect(card.getByRole('button', { name: 'Adicionar' })).toHaveCount(0)
    await a11y(page)
  })
})

test.describe('Fixes from user reviews', () => {
  test('FIX-3 sweet spot moves up with lead at the tip', async ({ page }) => {
    await start(page)
    const row = resultCard(page).locator('div').filter({ hasText: /^Ponto doce/ })
    await expect(row).toContainText('cm')
    const cm = async () => Number((await row.locator('.readout').textContent())!.replace(',', '.'))
    const before = await cm()
    await tapLead(page, '12h (ponta)', 6)
    await expect(async () => expect(await cm()).toBeGreaterThan(before)).toPass()
  })

  test('FIX-1 check the prediction against my measurement', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Confirmar com a minha medição' }).click()
    const card = page.getByRole('region', { name: 'Confirmar com a minha medição' })
    // From catalogue specs, a production frame's spread is the tolerance.
    await card.getByLabel('Peso', { exact: true }).fill('333')
    await expect(card.getByRole('status')).toContainText('Dentro do que varia uma raquete de série')
    await card.getByLabel('Peso', { exact: true }).fill('337')
    await expect(card.getByRole('status')).toContainText('Fora da tolerância')
    await a11y(page)
  })
})

test.describe('F02 use my own measured specs', () => {
  test('F02-H1 measured weight with a decimal comma', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Usar as minhas medições' }).click()
    await page.getByLabel('Peso', { exact: true }).fill('322,5')
    // 322,5 + strings 17 + overgrip 6
    await expect(resultCard(page)).toContainText('346')
  })

  test('F02-N1 text and out-of-range values show an error and are ignored', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Usar as minhas medições' }).click()
    const w = page.getByLabel('Peso', { exact: true })
    await w.fill('abc')
    await w.blur()
    await expect(page.getByRole('alert')).toHaveText('Introduz um número')
    await w.fill('900')
    await expect(page.getByRole('alert')).toContainText('Entre 150 e 450')
    await expect(resultCard(page)).toContainText('328')
  })

  test('F02-E1 blank fields fall back to the reference', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Usar as minhas medições' }).click()
    await expect(resultCard(page)).toContainText('328')
    await a11y(page)
  })
})
