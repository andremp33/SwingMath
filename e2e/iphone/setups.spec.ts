import { a11y, expect, saveSetup, start, test } from '../fixtures'
import type { Page } from '@playwright/test'

// Setups on an iPhone (WebKit, 390 px).

async function threeSetups(page: Page) {
  await start(page)
  for (const name of ['Leve', 'Média', 'Pesada']) {
    await saveSetup(page, name)
    await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
  }
  await page.goto('/setups')
  await expect(page.getByRole('article')).toHaveCount(3)
}

test('S01 saving suggests a name from the frame and the main change, editable', async ({ page }) => {
  await start(page)
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
  await page.getByRole('button', { name: 'Guardar setup' }).click()
  const name = page.getByRole('dialog').getByLabel('Nome do setup')
  await expect(name).toHaveValue('Pure Aero 98 · +2 g 3/9h')
  await name.fill('Pure Aero 98 · +2 g 3/9h (torneio)')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('A editar: Pure Aero 98 · +2 g 3/9h (torneio)')).toBeVisible()
})

test('S02 a card: the numbers, the strings, Open, and the rest under ⋯', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
  await saveSetup(page, 'Torneio')
  await page.goto('/setups')
  const card = page.getByRole('article', { name: 'Torneio' })
  // As it plays (strings on), like the calculator.
  await expect(card).toContainText(/\d{3} g · \d{3} mm · SW \d{3}/)
  await expect(card).toContainText('Cordas: Poli 23 kg')
  // The date on one line.
  const date = card.getByText(/^Editado /)
  expect((await date.boundingBox())!.height).toBeLessThan(22)
  // Under ⋯: compare (with a setup or a pro), edit, share, the stringer's sheet, delete.
  await card.getByRole('button', { name: 'Mais ações: Torneio' }).click()
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Comparar', 'Comparar com um profissional', 'Editar', 'Partilhar', 'Ficha para o encordoador', 'Apagar'])
  await a11y(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  // Open: in the calculator.
  await card.getByRole('button', { name: 'Abrir: Torneio' }).click()
  await expect(page.getByText('A editar: Torneio')).toBeVisible()
})

test('S03 compare: a box on each card, two at most, and a bar at the bottom', async ({ page }) => {
  await threeSetups(page)
  await page.getByRole('button', { name: 'Comparar', exact: true }).click()
  const bar = page.getByRole('region', { name: 'Comparar' })
  await expect(bar).toContainText('0 selecionados')
  await expect(bar.getByRole('button', { name: 'Comparar' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Selecionar Leve' }).check()
  await expect(bar).toContainText('1 selecionado')
  await page.getByRole('checkbox', { name: 'Selecionar Pesada' }).check()
  await expect(bar).toContainText('2 selecionados')
  // A third waits until one is unticked.
  await expect(page.getByRole('checkbox', { name: 'Selecionar Média' })).toBeDisabled()
  // The bar sits above the tab bar, on screen.
  const b = (await bar.boundingBox())!
  const tabs = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(tabs.y + 1)
  await a11y(page)
  await bar.getByRole('button', { name: 'Comparar' }).click()
  await expect(page.getByRole('heading', { name: 'Comparar setups' })).toBeVisible()
})

test('S04 “Compare” from a card’s menu starts with that setup ticked', async ({ page }) => {
  await threeSetups(page)
  await page.getByRole('button', { name: 'Mais ações: Média' }).click()
  await page.getByRole('menuitem', { name: 'Comparar', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Selecionar Média' })).toBeChecked()
  await expect(page.getByRole('region', { name: 'Comparar' })).toContainText('1 selecionado')
  // Cancel leaves the mode and the selection.
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
})
