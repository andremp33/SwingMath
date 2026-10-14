import { a11y, expect, saveSetup, start, test } from '../fixtures'
import type { Page } from '@playwright/test'

// Comparing two setups on an iPhone (WebKit, 390 px).

async function twoSetups(page: Page) {
  await start(page)
  // "Clube": RPM Blast at 24 kg, no lead.
  await page.getByRole('region', { name: 'Cordas' }).getByRole('button', { name: /^Cordas/ }).click()
  const card = page.getByRole('region', { name: 'Cordas' })
  await card.getByRole('combobox', { name: 'Corda' }).fill('rpm bl')
  await card.getByRole('option', { name: 'Babolat RPM Blast', exact: true }).click()
  await card.getByLabel('Tensão').fill('24')
  await saveSetup(page, 'Clube')
  // "Torneio": the same strings at 23 kg, and lead at 12h.
  await card.getByLabel('Tensão').fill('23')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
  await saveSetup(page, 'Torneio')
  await page.goto('/setups')
  await page.getByRole('button', { name: 'Comparar', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Selecionar Clube' }).check()
  await page.getByRole('checkbox', { name: 'Selecionar Torneio' }).check()
  await page.getByRole('region', { name: 'Comparar' }).getByRole('button', { name: 'Comparar' }).click()
  await expect(page.getByRole('heading', { name: 'Comparar setups' })).toBeVisible()
}

const cell = (page: Page, row: string, col: number) => page.getByRole('row', { name: new RegExp(`^${row}`) }).getByRole('cell').nth(col)

test('C01 each column says the setup, its racket and its strings; the difference has arrows, in a neutral colour', async ({ page }) => {
  await twoSetups(page)
  const table = page.getByRole('table')
  const heads = table.getByRole('columnheader')
  await expect(heads.nth(0)).toContainText('Clube')
  await expect(heads.nth(0)).toContainText('Babolat Pure Aero 98 (2026)')
  await expect(heads.nth(0)).toContainText('RPM Blast · 24 kg')
  await expect(heads.nth(1)).toContainText('Torneio')
  await expect(heads.nth(1)).toContainText('RPM Blast · 23 kg')
  await expect(heads.nth(2)).toHaveText(/^Diferença\s*2 − 1$/)
  // 2 g at the tip: heavier, and the difference reads as an arrow, not a colour.
  await expect(cell(page, 'Peso', 2)).toHaveText(/^↑\s*mais\s*2,0$/)
  await expect(cell(page, 'Tensão', 2)).toHaveText(/^↓\s*menos\s*1,0$/)
  const colour = await cell(page, 'Peso', 2).evaluate((el) => getComputedStyle(el).color)
  const text = await page.getByRole('heading', { name: 'Comparar setups' }).evaluate((el) => getComputedStyle(el).color)
  expect(colour).toBe(text)
  // Strings and accessories.
  await expect(cell(page, 'Corda', 0)).toHaveText('RPM Blast')
  await expect(cell(page, 'Tensão', 0)).toHaveText('24,0 kg')
  await expect(cell(page, 'Rigidez das cordas', 0)).toHaveText(/^\d+$/)
  await expect(cell(page, 'Acessórios', 0)).toContainText('Cordas')
  await a11y(page)
})

test('C02 feel: bars side by side, numbered, with a legend that matches the table', async ({ page }) => {
  await twoSetups(page)
  const feel = page.getByRole('region', { name: 'Sensação' })
  await expect(feel.getByRole('meter')).toHaveCount(12)
  for (const name of ['Clube', 'Torneio']) await expect(feel.getByRole('meter', { name: `Potência: ${name}` })).toBeVisible()
  // The same mark for each setup in the header and in the legend.
  const legend = feel.getByRole('list', { name: 'Legenda' }).getByRole('listitem')
  await expect(legend).toHaveText(['Clube', 'Torneio'])
  const markOf = (loc: ReturnType<Page['locator']>) => loc.locator('span[aria-hidden]').first().evaluate((el) => getComputedStyle(el).backgroundColor)
  const heads = page.getByRole('table').getByRole('columnheader')
  expect(await markOf(legend.nth(0))).toBe(await markOf(heads.nth(0)))
  expect(await markOf(legend.nth(1))).toBe(await markOf(heads.nth(1)))
  expect(await markOf(legend.nth(0))).not.toBe(await markOf(legend.nth(1)))
  // Each bar has its number next to it.
  const bar = feel.getByRole('meter', { name: 'Potência: Clube' })
  await expect(bar).toContainText(String(await bar.getAttribute('aria-valuenow')))
})
