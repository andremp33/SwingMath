import { a11y, expect, pickTarget, saveSetup, start, test } from './fixtures'
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
  test('F20-N1 without a racket of theirs: no preview, the four benefits, and what stays free', async ({ page }) => {
    await start(page)
    const d = await openPlans(page)
    await expect(d.getByText('As tuas raquetes iguais, sempre: a app avisa quando uma se afasta e diz como corrigir.')).toBeVisible()
    await expect(d.getByText(/^O teu Diário diz-te que corda e que tensão pôr, e quando trocar; a calculadora de cordas/)).toBeVisible()
    await expect(d.getByText(/^Chumbo certo à primeira, até à raquete de um pro/)).toBeVisible()
    await expect(d.getByText('Setups sem limite, em todos os teus aparelhos.')).toBeVisible()
    await expect(d.getByText(/^Continua grátis: .*até 5 setups/)).toBeVisible()
    await expect(d.getByTestId('preview-title')).toHaveCount(0)
  })

  test('F20-H1 their racket, as measured, against the pro they opened last: strips, never grams', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await start(page, { path: '/match' })
    await seedRacket(page, { measured: [300, 32, 300] })
    // Without Pro, picking a pro in Igualar opens Pro on them (and remembers them).
    await pickTarget(page, /Jannik Sinner/)
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(page.getByRole('region', { name: 'Onde queres chegar' }).getByRole('button', { name: /^Igualar a/ })).not.toContainText('Jannik Sinner')
    await expect(d.getByTestId('preview-title')).toHaveText(/^A tua Aero de jogo a \d+ tiras? de uma raquete do circuito ATP$/)
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
    await expect(d.getByTestId('preview-title')).toHaveText(/^A tua Aero de jogo a \d+ tiras? de uma raquete do circuito (ATP|WTA)$/)
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

  test('F20-H5 five setups free: the sixth opens Pro, the five stay', async ({ page }) => {
    await start(page)
    await page.evaluate(async () => {
      const dbUrl = '/src/data/db.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const now = Date.now()
      const base = { racketId: 'stock-babolat-pure-aero-98-2026', favourite: false, baseMode: 'reference', measured: {}, accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false }, leadG: { tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 }, ratings: {}, createdAt: now, updatedAt: now }
      await db.setups.bulkPut([1, 2, 3, 4, 5].map((n) => ({ ...base, id: `s${n}`, name: `Setup ${n}` })))
    })
    await page.getByRole('button', { name: 'Guardar setup' }).first().click()
    const d = page.getByRole('dialog', { name: 'SwingMath Pro' })
    await expect(d.getByRole('heading', { name: 'Setups sem limite' })).toBeVisible()
    await expect(d).toContainText('O grátis guarda 5 setups. Os que tens ficam todos.')
    await expect(page.getByRole('dialog', { name: 'Guardar setup' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto('/setups')
    await expect(page.getByRole('heading', { name: 'Setups' }).locator('..')).toContainText('Pro')
    await expect(page.getByText('Setup 5')).toBeVisible()
  })

  test('F20-H6 below the limit, the setups say how many of the free ones are used', async ({ page }) => {
    await start(page)
    await saveSetup(page, 'Clube')
    await page.goto('/setups')
    await expect(page.getByText('1 de 5 grátis')).toBeVisible()
  })

  test('F20-H7 with Pro, no count and a sixth setup saves', async ({ page }) => {
    await start(page, { pro: true })
    await page.evaluate(async () => {
      const dbUrl = '/src/data/db.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const now = Date.now()
      const base = { racketId: 'stock-babolat-pure-aero-98-2026', favourite: false, baseMode: 'reference', measured: {}, accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false }, leadG: { tip: 0, tenTwo: 0, threeNine: 0, throat: 0, handle: 0 }, ratings: {}, createdAt: now, updatedAt: now }
      await db.setups.bulkPut([1, 2, 3, 4, 5].map((n) => ({ ...base, id: `s${n}`, name: `Setup ${n}` })))
    })
    await saveSetup(page, 'Sexto')
    await page.goto('/setups')
    await expect(page.getByText(/de 5 grátis/)).toHaveCount(0)
    await expect(page.getByText('Sexto')).toBeVisible()
  })
})
