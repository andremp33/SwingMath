import { a11y, expand, expect, start, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'

/** Types in the string's name field and picks a suggestion. */
async function pickString(scope: Locator, typed: string, option: string, field = 'Corda') {
  const box = scope.getByRole('combobox', { name: field })
  await box.fill(typed)
  await scope.getByRole('listbox', { name: field }).getByRole('option', { name: option, exact: true }).click()
  await expect(box).toHaveValue(option)
}

async function logSession(page: Page, overall: number) {
  await page.getByRole('button', { name: 'Registar sessão' }).last().click()
  const d = page.getByRole('dialog', { name: 'Sessão' })
  await d.getByRole('radiogroup', { name: 'Duração' }).getByRole('radio', { name: '60 min' }).click()
  await d.getByRole('radiogroup', { name: 'Como correu' }).getByRole('radio', { name: `${overall}/5` }).click()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
}

test.describe('F18 the strings by name', () => {
  test('F18-H1 choosing a string fills in its material and offers its gauges', async ({ page }) => {
    await start(page)
    await expand(page, 'Cordas')
    const card = page.getByRole('region', { name: 'Cordas' })
    await pickString(card, 'rpm bl', 'Babolat RPM Blast')
    // The material comes with the string; its gauges replace the material.
    await expect(card.getByLabel('Material')).toHaveCount(0)
    await expect(card).toContainText('Poliéster · Página do fabricante')
    await expect(card.getByRole('link', { name: 'Página do fabricante' })).toHaveAttribute('href', /babolat\.com/)
    const gauge = card.getByLabel('Calibre')
    await expect(gauge.locator('option')).toHaveText(['Não sei', '1,20 mm', '1,25 mm', '1,30 mm', '1,35 mm'])
    await gauge.selectOption('1.25')
    await a11y(page)
    // Closed, the section says it in a few words.
    await card.getByRole('button', { name: /^Cordas/ }).click()
    await expect(card).toContainText('RPM Blast 1,25 · 23 kg')
  })

  test('F18-H2 a name of one’s own, with the material by hand; the keyboard works', async ({ page }) => {
    await start(page)
    await expand(page, 'Cordas')
    const card = page.getByRole('region', { name: 'Cordas' })
    const box = card.getByRole('combobox', { name: 'Corda' })
    await box.fill('Corda do clube')
    await page.keyboard.press('Escape')
    await card.getByLabel('Material').selectOption('multi')
    await expect(card.getByLabel('Calibre')).toHaveCount(0)
    // A hybrid: the crosses get their own name, picked with the keyboard.
    await card.getByRole('switch', { name: 'Híbrido: cruzadas diferentes' }).click()
    const crosses = card.getByRole('combobox', { name: 'Corda (cruzadas)' })
    await crosses.fill('touch vs')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await expect(crosses).toHaveValue('Babolat Touch VS')
    await expect(card).toContainText('Tripa natural · Página do fabricante')
    await card.getByRole('button', { name: /^Cordas/ }).click()
    await expect(card).toContainText('Corda do clube · 23 / Touch VS · 23 kg')
  })

  test('F18-H3 the strings used last come first', async ({ page }) => {
    await start(page)
    await expand(page, 'Cordas')
    const card = page.getByRole('region', { name: 'Cordas' })
    await pickString(card, 'hyper-g so', 'Solinco Hyper-G Soft')
    await card.getByRole('switch', { name: 'Híbrido: cruzadas diferentes' }).click()
    await card.getByRole('combobox', { name: 'Corda (cruzadas)' }).focus()
    const list = card.getByRole('listbox', { name: 'Corda (cruzadas)' })
    await expect(list).toContainText('Usadas recentemente')
    await expect(list.getByRole('option').first()).toHaveText(/Solinco\s*Hyper-G Soft/)
  })

  test('F18-H4 the journal shows the name, and its analysis puts the same strings together', async ({ page }) => {
    await start(page, { path: '/diario', pro: true })
    await page.getByRole('button', { name: 'Nova raquete' }).first().click()
    const d = page.getByRole('dialog', { name: 'Nova raquete' })
    await d.getByLabel('Nome', { exact: true }).fill('Blade')
    await pickString(d, 'alu power', 'Luxilon ALU Power')
    await d.getByLabel('Calibre').selectOption('1.25')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets).toContainText('ALU Power 1,25 · 23 kg')
    await logSession(page, 4)
    // Restrung with the same strings: one row in the analysis, two stringings.
    await rackets.getByRole('button', { name: 'Encordei' }).click()
    const r = page.getByRole('dialog', { name: 'Encordoamento' })
    await expect(r.getByRole('combobox', { name: 'Corda' })).toHaveValue('Luxilon ALU Power')
    await r.getByRole('button', { name: 'Guardar' }).click()
    await expect(r).toBeHidden()
    await logSession(page, 2)
    const best = page.getByRole('region', { name: 'O que joga melhor' }).getByRole('listitem')
    await expect(best).toHaveCount(1)
    await expect(best).toContainText('ALU Power 1,25 · 23 kg')
    await expect(best).toContainText('2 encordoamentos · 2 sessões')
    await expect(best).toContainText('3,0')
  })
})
