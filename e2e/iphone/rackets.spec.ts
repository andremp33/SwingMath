import { a11y, expect, seedOwned, start, swipe, swipedBy, test } from '../fixtures'
import type { Page } from '@playwright/test'

// The player's rackets on an iPhone (WebKit, 390 px): swipe left to delete,
// with an undo; the same by button in the edit sheet.

async function open(page: Page) {
  await start(page, { path: '/rackets' })
  await seedOwned(page)
  const list = page.getByRole('region', { name: 'As tuas raquetes' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  return list
}

test('R01 a full swipe deletes it, says what went with it, and Anular brings it all back', async ({ page, hasTouch }) => {
  const list = await open(page)
  const row = list.getByRole('listitem').filter({ hasText: 'Aero #1' })
  await swipe(page, row, -300, { touch: hasTouch })
  await expect(row).toHaveCount(0)
  await expect(page.getByText('Aero #1 apagada, com 2 encordoamentos e 1 medição')).toBeVisible()
  await page.getByRole('button', { name: 'Anular' }).click()
  await expect(row).toContainText('Poli 23 kg')
})

test('R02 a short swipe uncovers Apagar; a tap on the card closes it, a tap on Apagar deletes', async ({ page, hasTouch }) => {
  const list = await open(page)
  const row = list.getByRole('listitem').filter({ hasText: 'Aero #2' })
  const del = page.getByRole('button', { name: 'Apagar Aero #2' })
  await swipe(page, row, -100, { touch: hasTouch })
  await expect.poll(() => swipedBy(row)).toBe(-88)
  await a11y(page)
  // A tap on the open card only closes it: no trip to the calculator.
  await row.getByRole('button', { name: 'Usar na calculadora: Aero #2' }).click()
  await expect.poll(() => swipedBy(row)).toBe(0)
  await expect(page).toHaveURL(/\/rackets$/)
  await swipe(page, row, -100, { touch: hasTouch })
  await expect.poll(() => swipedBy(row)).toBe(-88)
  await del.click()
  await expect(row).toHaveCount(0)
  await expect(page.getByText('Aero #2 apagada', { exact: true })).toBeVisible()
})

test('R03 without a gesture: edit sheet deletes with an undo', async ({ page }) => {
  const list = await open(page)
  await page.getByRole('button', { name: 'Editar Aero #1' }).click()
  await page.getByRole('dialog', { name: 'Editar raquete' }).getByRole('button', { name: 'Apagar' }).click()
  await expect(list.getByRole('listitem').filter({ hasText: 'Aero #1' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Anular' }).last().click()
  await expect(list.getByRole('listitem').filter({ hasText: 'Aero #1' })).toBeVisible()
})

