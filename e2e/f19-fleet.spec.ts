import { periodFromSwingweight } from '../src/domain/measure'
import { a11y, expect, start, test } from './fixtures'
import type { Page } from '@playwright/test'

const DAY = 86_400_000

interface Seed {
  id: string
  name: string
  /** Weight, balance (cm) and swingweight, measured with strings. */
  m?: [number, number, number]
  /** Days since it was strung; none: no stringing. */
  strungDaysAgo?: number
}

/** The player's rackets, straight into the journal, each measured ten days ago. */
async function seed(page: Page, rackets: Seed[]) {
  await page.evaluate(
    async ({ rackets, DAY }) => {
      const dbUrl = '/src/data/db.ts'
      const racketsUrl = '/src/data/rackets.ts'
      const { db } = await import(/* @vite-ignore */ dbUrl)
      const { STOCK_RACKETS } = await import(/* @vite-ignore */ racketsUrl)
      const now = Date.now()
      for (const [i, r] of rackets.entries()) {
        const measurements = r.m ? [{ id: `${r.id}-m`, date: now - 10 * DAY, weightG: r.m[0], balanceCm: r.m[1], swingweight: r.m[2], strung: true, origin: 'shop' }] : undefined
        await db.owned.put({ id: r.id, name: r.name, racketId: STOCK_RACKETS[0].id, measurements, createdAt: i + 1, updatedAt: i + 2 })
        if (r.strungDaysAgo !== undefined) {
          const at = now - r.strungDaysAgo * DAY
          await db.stringings.put({ id: `${r.id}-s`, ownedId: r.id, label: r.name, racketId: STOCK_RACKETS[0].id, date: at, bed: { mains: { material: 'poly', tensionKg: 23 } }, createdAt: at, updatedAt: at + 1 })
        }
      }
    },
    { rackets, DAY },
  )
}

const FLEET: Seed[] = [
  { id: 'a', name: 'Aero A', m: [318, 32.0, 324] },
  { id: 'b', name: 'Aero B', m: [320, 32.0, 326] },
  { id: 'c', name: 'Aero C', m: [326, 32.3, 325] },
]

test.describe('F19 the fleet', () => {
  test('F19-H1 a pendulum measurement goes to a racket; seeing and deleting it is free', async ({ page }) => {
    await start(page, { path: '/medir' })
    await seed(page, [{ id: 'a', name: 'Aero A', strungDaysAgo: 3 }])
    await page.getByLabel('Peso', { exact: true }).fill('320')
    await page.getByLabel('Equilíbrio', { exact: true }).fill('320')
    const save = page.getByRole('button', { name: 'Guardar na raquete…' })
    // Not before there is a swingweight.
    await expect(save).toBeDisabled()
    const T = periodFromSwingweight(320, 32, 320)
    await page.getByLabel(/Ou escreve o tempo total/).fill((T * 20).toFixed(3).replace('.', ','))
    await page.getByRole('button', { name: 'Juntar tentativa' }).click()
    await save.click()
    const d = page.getByRole('dialog', { name: 'Guardar na raquete' })
    await expect(d).toContainText('320 g · 320 mm · SW 320')
    await expect(d.getByRole('radio', { name: 'Aero A' })).toHaveAttribute('aria-checked', 'true')
    await a11y(page)
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Medição guardada em Aero A')).toBeVisible()

    await page.goto('/diario')
    await page.getByRole('region', { name: 'As tuas raquetes' }).getByRole('button', { name: 'Aero A', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Aero A' })
    const list = sheet.getByRole('region', { name: 'Medições' })
    await expect(list).toContainText('320 g · 320 mm · SW 320')
    await expect(list).toContainText('Pêndulo · com cordas')
    await list.getByRole('button', { name: /^Apagar a medição de/ }).click()
    await expect(list).toContainText('Ainda sem medições')
  })

  test('F19-H2 a measurement typed in on the racket moves the fleet; restringing asks to measure again', async ({ page }) => {
    await start(page, { path: '/diario' })
    await seed(page, [{ id: 'a', name: 'Aero A', m: [318, 32.0, 324], strungDaysAgo: 30 }])
    await page.getByRole('region', { name: 'As tuas raquetes' }).getByRole('button', { name: 'Aero A', exact: true }).click()
    await page.getByRole('dialog', { name: 'Aero A' }).getByRole('button', { name: 'Adicionar medição' }).click()
    const d = page.getByRole('dialog', { name: 'Nova medição' })
    await d.getByLabel('Peso', { exact: true }).fill('321')
    await d.getByLabel('Equilíbrio', { exact: true }).fill('322')
    await d.getByLabel('Swingweight', { exact: true }).fill('327')
    await expect(d.getByRole('radio', { name: 'Loja (RDC)' })).toHaveAttribute('aria-checked', 'true')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()
    await page.goto('/perfil')
    const fleet = page.getByRole('region', { name: 'A tua frota' })
    // The newest first: the fleet shows it.
    await expect(fleet).toContainText('321 g · 322 mm · SW 327')
    await expect(fleet).not.toContainText('Encordaste depois da última medição')
    // Restrung today: the numbers have moved.
    await page.getByRole('button', { name: 'Encordei hoje: Aero A' }).click()
    await expect(fleet).toContainText('Encordaste depois da última medição: mede outra vez.')
  })

  test('F19-N1 free: the list, and the comparison behind the lock', async ({ page }) => {
    await start(page, { path: '/perfil' })
    await seed(page, [...FLEET, { id: 'd', name: 'Velha' }])
    const fleet = page.getByRole('region', { name: 'A tua frota' })
    await expect(fleet).toContainText('Aero A')
    await expect(fleet).toContainText('318 g · 320 mm · SW 324')
    await expect(fleet).toContainText('Sem medições')
    await expect(fleet.getByRole('button', { name: 'Experimentar o Pro' })).toBeVisible()
    // No light of the player's own rackets is on the page.
    await expect(fleet.getByRole('listitem', { name: /: (igual|perto|longe)$/ })).toHaveCount(0)
    await a11y(page)
  })

  test('F19-H3 Pro: each racket against #1, with its lights, and #1 can be changed', async ({ page }) => {
    await start(page, { path: '/perfil', pro: true })
    await seed(page, FLEET)
    const fleet = page.getByRole('region', { name: 'A tua frota' })
    // The highest swingweight is #1 by default.
    await expect(fleet.getByLabel('Raquete de referência (#1)')).toHaveValue('b')
    const compare = fleet.getByRole('list', { name: 'Comparar com a #1' })
    await expect(compare.getByRole('listitem', { name: 'Peso −2 g: perto' })).toBeVisible()
    await expect(compare.getByRole('listitem', { name: 'SW −2: perto' })).toBeVisible()
    await expect(compare.getByRole('listitem', { name: 'Peso +6 g: longe' })).toBeVisible()
    await expect(compare.getByRole('listitem', { name: 'Equilíbrio +3 mm: longe' })).toBeVisible()
    await a11y(page)
    await fleet.getByLabel('Raquete de referência (#1)').selectOption('a')
    await expect(compare.getByRole('listitem', { name: 'Peso +2 g: perto' })).toBeVisible()
    // Remembered.
    await page.reload()
    await expect(fleet.getByLabel('Raquete de referência (#1)')).toHaveValue('a')
  })

  test('F19-H4 Pro: “Match to #1” brings the fleet to Igualar, and a plan’s lead can be saved to the racket', async ({ page }) => {
    await start(page, { path: '/perfil', pro: true })
    await seed(page, FLEET)
    await page.getByRole('button', { name: 'Igualar à #1' }).click()
    await expect(page.getByRole('heading', { name: 'Planear' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Alvo' }).getByRole('radio', { name: 'A raquete 1' })).toHaveAttribute('aria-checked', 'true')
    // Each racket by its name and its measurement, #1 first.
    for (const name of ['Aero B', 'Aero A', 'Aero C']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(page.getByLabel('Peso', { exact: true }).first()).toHaveValue('320')
    await page.getByRole('button', { name: 'Calcular' }).click()
    await expect(page.getByRole('heading', { name: 'Alvo: Aero B' })).toBeVisible()
    // #1 has nothing to do; Aero C is heavier, and lead cannot take weight off.
    await expect(page.getByRole('region', { name: 'Aero B' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Aero C' })).toContainText('Peso já está acima do alvo')
    await page.getByRole('button', { name: 'Guardar este chumbo em Aero A' }).click()
    await expect(page.getByText('Chumbo guardado em Aero A. Depois de o pores, mede outra vez.')).toBeVisible()
    await page.goto('/diario')
    await page.getByRole('region', { name: 'As tuas raquetes' }).getByRole('button', { name: 'Aero A', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Aero A' }).getByRole('region', { name: 'Medições' })).toContainText(/Chumbo posto: \d/)
  })

  test('F19-E1 Igualar matches three rackets, or six with Pro', async ({ page }) => {
    await start(page, { path: '/match' })
    await page.getByRole('radio', { name: 'Igualar raquetes' }).click()
    const add = page.getByRole('button', { name: 'Adicionar raquete' })
    await add.click()
    await expect(page.getByRole('heading', { name: 'Raquete 3' })).toBeVisible()
    await expect(add).toHaveCount(0)
  })

  test('F19-E2 Pro: up to six rackets', async ({ page }) => {
    await start(page, { path: '/match', pro: true })
    await page.getByRole('radio', { name: 'Igualar raquetes' }).click()
    const add = page.getByRole('button', { name: 'Adicionar raquete' })
    for (let i = 0; i < 4; i++) await add.click()
    await expect(page.getByRole('heading', { name: 'Raquete 6' })).toBeVisible()
    await expect(add).toHaveCount(0)
  })
})
