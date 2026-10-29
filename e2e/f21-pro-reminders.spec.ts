import { a11y, expect, start, test } from './fixtures'
import type { Page } from '@playwright/test'

const DAY = 86_400_000

/** One racket of the player's, strung 10 days ago and played twice; the
 *  paywall last open `seenDaysAgo` days ago. Then the app opens again (at `path`). */
async function seed(page: Page, seenDaysAgo: number, path?: string) {
  await page.evaluate(
    async ({ seenDaysAgo, DAY }) => {
      const dbUrl = '/src/data/db.ts'
      const racketsUrl = '/src/data/rackets.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const { STOCK_RACKETS } = await import(/* @vite-ignore */ racketsUrl)
      const now = Date.now()
      await db.owned.put({ id: 'o1', name: 'Aero de jogo', racketId: STOCK_RACKETS[0].id, createdAt: 1, updatedAt: 2 })
      await db.stringings.put({ id: 's1', ownedId: 'o1', label: 'Aero de jogo', racketId: STOCK_RACKETS[0].id, date: now - 10 * DAY, bed: { mains: { material: 'poly', tensionKg: 23 } }, createdAt: 1, updatedAt: 2 })
      for (let i = 0; i < 2; i++)
        await db.sessions.put({ id: `x${i}`, date: now - (8 - i) * DAY, minutes: 90, kind: 'practice', stringingId: 's1', ratings: { overall: 4 }, createdAt: i, updatedAt: i + 1 })
      const saved = JSON.parse(localStorage.getItem('swingmath')!)
      saved.state.proNudgeAt = now - seenDaysAgo * DAY
      localStorage.setItem('swingmath', JSON.stringify(saved))
    },
    { seenDaysAgo, DAY },
  )
  await (path ? page.goto(path) : page.reload())
}

const nudgeAt = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('swingmath')!).state.proNudgeAt as number | null)

test.describe('F21 Pro brought up again, and the restring reminder', () => {
  test('F21-N1 the first launch starts the clock: no paywall', async ({ page }) => {
    await start(page, { path: '/diario' })
    await expect(page.getByRole('heading', { name: 'Diário' })).toBeVisible()
    await expect.poll(() => nudgeAt(page)).not.toBeNull()
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
  })

  test('F21-N2 less than a week since the paywall: nothing', async ({ page }) => {
    await start(page, { path: '/diario' })
    await seed(page, 6)
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero de jogo')
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
  })

  test('F21-H1 a week on: the paywall on their own report, once', async ({ page }) => {
    await start(page, { path: '/diario' })
    await seed(page, 8)
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d.getByRole('heading', { name: 'Sabe quando a corda morre' })).toBeVisible()
    await expect(d.getByTestId('teaser-number')).toHaveText('Vai em 3,0 h de jogo')
    // Seen: the clock starts again.
    expect(Date.now() - (await nudgeAt(page))!).toBeLessThan(60_000)
    await d.getByRole('button', { name: 'Fechar' }).click()
    await page.reload()
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero de jogo')
    await expect(d).toHaveCount(0)
  })

  test('F21-N3 with Pro: never brought up', async ({ page }) => {
    await start(page, { path: '/diario', pro: true })
    await seed(page, 40)
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero de jogo')
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
  })

  test('F21-H2 a tapped reminder: its sheet, what Pro says blurred, then the plans; not the weekly paywall too', async ({ page }) => {
    await start(page, { path: '/diario' })
    // Due for the weekly paywall, but the app opens on the reminder.
    await seed(page, 8, '/diario?lembrete=s1')
    const r = page.getByRole('dialog', { name: 'Está na altura de encordar' })
    await expect(r).toContainText('Aero de jogo')
    await expect(r.getByTestId('reminder-headline')).toHaveText('Vai em 3,0 h de jogo')
    await expect(r.getByTestId('reminder-pro')).toContainText('o Pro diz-te que tensão pôr e quando trocar')
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toHaveCount(0)
    await a11y(page)
    await r.getByRole('button', { name: 'Ver o Pro' }).click()
    await expect(r).toHaveCount(0)
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d.getByTestId('teaser-number')).toHaveText('Vai em 3,0 h de jogo')
    await expect(page).toHaveURL(/\/diario$/)
  })

  test('F21-H3 with Pro: the reminder leads to the new stringing, or the report', async ({ page }) => {
    await start(page, { path: '/diario', pro: true })
    await seed(page, 0, '/diario?lembrete=s1')
    const r = page.getByRole('dialog', { name: 'Está na altura de encordar' })
    await expect(r.getByTestId('reminder-pro')).toHaveCount(0)
    await r.getByRole('button', { name: 'Ver o relatório destas cordas' }).click()
    await expect(page.getByRole('dialog', { name: 'Relatório da corda' }).getByTestId('report-next')).toBeVisible()
    await page.getByRole('dialog', { name: 'Relatório da corda' }).getByRole('button', { name: 'Fechar' }).click()
    await page.goto('/diario?lembrete=s1')
    await page.getByRole('dialog', { name: 'Está na altura de encordar' }).getByRole('button', { name: 'Encordei' }).click()
    await expect(page.getByRole('dialog', { name: /Encord/ })).toBeVisible()
  })
})
