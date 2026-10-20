import { a11y, expect, start, test } from './fixtures'
import type { Page } from '@playwright/test'

const DAY = 86_400_000

/** One racket of the player's, measured with strings; optionally played. */
async function seedRacket(page: Page, opts: { measured?: [number, number, number]; sessions?: number } = {}) {
  await page.evaluate(
    async ({ opts, DAY }) => {
      const dbUrl = '/src/data/db.ts'
      const racketsUrl = '/src/data/rackets.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const { STOCK_RACKETS } = await import(/* @vite-ignore */ racketsUrl)
      const now = Date.now()
      const m = opts.measured
      await db.owned.put({
        id: 'o1',
        name: 'Aero de jogo',
        racketId: STOCK_RACKETS[0].id,
        measurements: m ? [{ id: 'm1', date: now - DAY, weightG: m[0], balanceCm: m[1], swingweight: m[2], strung: true, origin: 'pendulum' }] : undefined,
        createdAt: 1,
        updatedAt: 2,
      })
      await db.stringings.put({ id: 's1', ownedId: 'o1', label: 'Aero de jogo', racketId: STOCK_RACKETS[0].id, date: now - 10 * DAY, bed: { mains: { material: 'poly', tensionKg: 23 } }, createdAt: 1, updatedAt: 2 })
      for (let i = 0; i < (opts.sessions ?? 0); i++)
        await db.sessions.put({ id: `x${i}`, date: now - (8 - i) * DAY, minutes: 90, kind: 'practice', stringingId: 's1', ratings: { overall: 4 }, createdAt: i, updatedAt: i + 1 })
    },
    { opts, DAY },
  )
}

async function openPlans(page: Page) {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Ver planos' }).click()
  return page.getByRole('dialog', { name: 'SwingMath Pro' })
}

test.describe('F20 the paywall with the player’s racket', () => {
  test('F20-N1 without a racket of theirs: no preview, the three benefits', async ({ page }) => {
    await start(page)
    const d = await openPlans(page)
    await expect(d.getByText('As tuas raquetes iguais, sempre: a app avisa quando uma se afasta e diz como corrigir.')).toBeVisible()
    await expect(d.getByText('O teu Diário diz-te que corda e que tensão pôr, e quando trocar.')).toBeVisible()
    await expect(d.getByText('Chumbo certo à primeira, até chegares à raquete de um pro.')).toBeVisible()
    await expect(d.getByTestId('preview-title')).toHaveCount(0)
  })

  test('F20-H1 their racket, as measured, against the pro they opened last: strips, never grams', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await start(page, { path: '/match' })
    await seedRacket(page, { measured: [300, 32, 300] })
    // Opening a pro in Igualar remembers them.
    const to = page.getByRole('region', { name: 'Onde queres chegar' })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await to.getByRole('radio', { name: /Jannik Sinner/ }).click()
    const d = await openPlans(page)
    await expect(d.getByTestId('preview-title')).toHaveText(/^A tua Aero de jogo a \d+ tiras? da do Jannik Sinner$/)
    // Less motion: the final state straight away, the swingweight up to Sinner's.
    await expect(d.getByTestId('preview-sw')).toHaveAttribute('data-done', 'true')
    const sw = Number((await d.getByTestId('preview-sw').textContent())!.replace(/\D/g, ''))
    expect(sw).toBeGreaterThan(300)
    // The grams are what Pro sells.
    await expect(d.getByTestId('preview-title').locator('..').locator('..')).not.toContainText(/\d\s?g\b/)
    await a11y(page)
  })

  test('F20-H2 no pro opened yet: the nearest one lead can reach, the strips coming in one by one', async ({ page }) => {
    await start(page)
    await seedRacket(page, { measured: [318, 32.5, 322] })
    const d = await openPlans(page)
    await expect(d.getByTestId('preview-title')).toHaveText(/^A tua Aero de jogo a \d+ tiras? da (do|da) .+$/)
    // It climbs, then stops at the target.
    const sw = d.getByTestId('preview-sw')
    await expect(sw).not.toHaveAttribute('data-done', 'true')
    await expect(sw).toHaveAttribute('data-done', 'true', { timeout: 15_000 })
  })

  test('F20-H3 from the journal: the real number from their strings, the rest blurred', async ({ page }) => {
    await start(page, { path: '/diario' })
    await seedRacket(page, { sessions: 2 })
    await page.getByRole('region', { name: 'O que joga melhor' }).getByRole('button', { name: 'Experimentar o Pro' }).click()
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d.getByRole('heading', { name: 'Descobre o que joga melhor' })).toBeVisible()
    await expect(d.getByTestId('teaser-number')).toHaveText('Vai em 3,0 h de jogo')
    await expect(d.getByTestId('preview-title')).toHaveCount(0)
    await a11y(page)
  })

  test('F20-H4 from the fleet: their rackets, the lights blurred', async ({ page }) => {
    await start(page, { path: '/perfil' })
    await seedRacket(page, { measured: [318, 32.5, 322] })
    await page.getByRole('region', { name: 'A tua frota' }).getByRole('button', { name: 'Experimentar o Pro' }).click()
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d.getByRole('heading', { name: 'Iguala a tua frota' })).toBeVisible()
    await expect(d.getByRole('listitem').filter({ hasText: 'Aero de jogo' })).toBeVisible()
    await expect(d.getByRole('listitem', { name: /: (igual|perto|longe)$/ })).toHaveCount(0)
  })
})
