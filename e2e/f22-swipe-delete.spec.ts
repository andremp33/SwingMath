import { a11y, expect, seedOwned, start, swipe, swipedBy, test } from './fixtures'
import type { Page } from '@playwright/test'

// The player's rackets on the Rackets tab: swipe left to delete, with an
// undo; the same by button, for a keyboard or a mouse.

async function open(page: Page) {
  await start(page, { path: '/rackets' })
  await seedOwned(page)
  const list = page.getByRole('region', { name: 'As tuas raquetes' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  return list
}

/** How many stringings are left, and what the session is linked to. */
const history = (page: Page) =>
  page.evaluate(async () => {
    const dbUrl = '/src/data/db.ts'
    const { db } = await import(/* @vite-ignore */ dbUrl)
    return { stringings: await db.stringings.count(), session: (await db.sessions.get('se1'))?.stringingId ?? null }
  })

test.describe('F22 swipe to delete a racket', () => {
  test('F22-1 a full swipe deletes it, says what went with it, and Anular brings it all back', async ({ page, hasTouch }) => {
    const list = await open(page)
    const row = list.getByRole('listitem').filter({ hasText: 'Aero #1' })
    await swipe(page, row, -300, { touch: hasTouch })
    await expect(row).toHaveCount(0)
    await expect(page.getByText('Aero #1 apagada, com 2 encordoamentos e 1 medição')).toBeVisible()
    // The sessions stay, unlinked.
    expect(await history(page)).toEqual({ stringings: 0, session: null })
    await page.getByRole('button', { name: 'Anular' }).click()
    await expect(row).toContainText('Poli 23 kg')
    expect(await history(page)).toEqual({ stringings: 2, session: 'st2' })
  })

  test('F22-2 a short swipe uncovers Apagar; a tap on the card closes it, a tap on Apagar deletes', async ({ page, hasTouch }) => {
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

  test('F22-3 without a gesture: Tab opens the row on Apagar, Enter deletes; the edit sheet deletes with an undo', async ({ page }) => {
    const list = await open(page)
    const row = list.getByRole('listitem').filter({ hasText: 'Aero #2' })
    await page.getByRole('button', { name: 'Editar Aero #2' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Apagar Aero #2' })).toBeFocused()
    await expect.poll(() => swipedBy(row)).toBe(-88)
    await page.keyboard.press('Enter')
    await expect(row).toHaveCount(0)

    // No confirm first: the toast's Anular is the way back.
    page.on('dialog', (d) => {
      throw new Error(`unexpected dialog: ${d.message()}`)
    })
    await page.getByRole('button', { name: 'Editar Aero #1' }).click()
    await page.getByRole('dialog', { name: 'Editar raquete' }).getByRole('button', { name: 'Apagar' }).click()
    await expect(list.getByRole('listitem')).toHaveCount(0)
    // The newest toast is the last.
    await page.getByRole('button', { name: 'Anular' }).last().click()
    await expect(list.getByRole('listitem').filter({ hasText: 'Aero #1' })).toBeVisible()
  })

  test('F22-4 a vertical drag on a card scrolls the page and leaves the card where it is', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'a finger only')
    const list = await open(page)
    const row = list.getByRole('listitem').filter({ hasText: 'Aero #1' })
    // The app scrolls in its own container, not the window.
    const scrolled = () => page.evaluate(() => Math.max(scrollY, ...[...document.querySelectorAll('*')].map((e) => e.scrollTop)))
    await swipe(page, row, -6, { touch: true, dy: -300 })
    await expect.poll(scrolled).toBeGreaterThan(100)
    expect(await swipedBy(row)).toBe(0)
  })
})
