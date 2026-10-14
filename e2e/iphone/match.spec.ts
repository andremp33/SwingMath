import { a11y, expect, start, test } from '../fixtures'
import type { Page } from '@playwright/test'

// Igualar on an iPhone (WebKit, 390 px).

/** A racket of the player's, strung at 23 kg, made in the journal; then
 *  Igualar, once the journal has finished loading (leaving a page while
 *  its chunks load makes WebKit report the cut-short imports). */
async function myRacket(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nova raquete' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova raquete' })
  await d.getByLabel('Nome', { exact: true }).fill(name)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
  await page.waitForLoadState('networkidle')
  await page.goto('/match')
}

const step = (page: Page, name: string) => page.getByRole('region', { name })

test('M01 by default it starts from the player’s racket, as played, with strings', async ({ page }) => {
  await start(page, { path: '/diario' })
  await myRacket(page, 'A de torneio')
  const from = step(page, 'De onde partes')
  await expect(from.getByLabel('Ponto de partida')).toHaveValue(/^owned:/)
  await expect(from.getByLabel('Ponto de partida').locator('option:checked')).toHaveText('A de torneio')
  await expect(from).toContainText('Com cordas, como a jogas.')
  await expect(from).toContainText('com cordas')
  // Whole numbers.
  await expect(from).toContainText(/^.*\d{3} g · \d{3} mm · SW \d{3}/)
  // The groups: my rackets, saved setups, others (the library).
  await expect(from.getByLabel('Ponto de partida').locator('optgroup')).toHaveCount(2)
  await a11y(page)
})

test('M02 the library is the alternative; a target of the other kind is converted, and says so', async ({ page }) => {
  await start(page, { path: '/diario' })
  await myRacket(page, 'A de torneio')
  const from = step(page, 'De onde partes')
  const to = step(page, 'Onde queres chegar')
  // A library frame (unstrung) as the target of a strung starting point.
  await to.getByRole('button', { name: /Igualar a outra raquete/ }).click()
  await page.getByRole('dialog').getByRole('searchbox').fill('blade 98 16x19 v9')
  await page.getByRole('dialog').getByRole('listitem').first().getByRole('button').click()
  await expect(to).toContainText('Medida sem cordas; convertemos para com cordas, como o teu ponto de partida.')
  const strungWeight = Number(await to.getByLabel('Peso', { exact: true }).inputValue())
  // The library's frame as the starting point: no conversion, 16 g less.
  await from.getByLabel('Ponto de partida').selectOption({ label: 'Outra raquete da biblioteca' })
  await expect(from).toContainText('Sem cordas, como na biblioteca.')
  await expect(from.getByRole('button', { name: /Babolat Pure Aero 98/ })).toBeVisible()
  await expect(to).not.toContainText('convertemos')
  expect(strungWeight - Number(await to.getByLabel('Peso', { exact: true }).inputValue())).toBeGreaterThanOrEqual(15)
})

test('M03 whole numbers in every field', async ({ page }) => {
  await start(page, { path: '/match' })
  await step(page, 'De onde partes').getByRole('button', { name: 'Ajustar valores' }).click()
  await step(page, 'Onde queres chegar').getByRole('radio', { name: 'Profissional' }).click()
  await page.getByRole('radio', { name: /Novak Djokovic/ }).click()
  for (const name of ['De onde partes', 'Onde queres chegar'])
    for (const field of ['Peso', 'Equilíbrio', 'Swingweight']) await expect(step(page, name).getByLabel(field, { exact: true })).toHaveValue(/^\d+$/)
})

test('M04 three steps, with the target in sight', async ({ page }) => {
  await start(page, { path: '/match' })
  const titles = page.getByRole('heading', { level: 2 })
  await expect(titles.filter({ hasText: /De onde partes|Onde queres chegar|Onde pôr o chumbo/ })).toHaveText([/De onde partes/, /Onde queres chegar/, /Onde pôr o chumbo/])
  // Step 2 starts within the first screen.
  const two = (await step(page, 'Onde queres chegar').boundingBox())!
  expect(two.y).toBeLessThan(page.viewportSize()!.height)
})
