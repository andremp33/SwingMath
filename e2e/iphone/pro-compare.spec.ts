import { a11y, expect, saveSetup, start, tapLead, test } from '../fixtures'
import type { Page } from '@playwright/test'

// A saved setup next to a pro, on an iPhone (WebKit, 390 px).

async function setupAndPro(page: Page, player: RegExp) {
  await start(page, { pro: true })
  await tapLead(page, '3h e 9h')
  await saveSetup(page, 'Torneio')
  await page.goto('/setups')
  await page.getByRole('button', { name: 'Mais ações: Torneio' }).click()
  await page.getByRole('menuitem', { name: 'Comparar com um profissional' }).click()
  await expect(page.getByRole('heading', { name: 'Comparar com um profissional' })).toBeVisible()
  // The same picker as in Igualar: search, ATP and WTA, the seal.
  await expect(page.getByRole('radiogroup', { name: 'Profissional ATP' })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Profissional WTA' })).toBeVisible()
  await page.getByLabel('Procurar jogador').fill(player.source.split(' ')[0])
  await page.getByRole('radio', { name: player }).click()
  await expect(page.getByRole('table')).toBeVisible()
}

const cell = (page: Page, row: string, col: number) => page.getByRole('row', { name: new RegExp(`^${row}`) }).getByRole('cell').nth(col)

test('PC01 a pro measured unstrung is converted to strung, and the page says so', async ({ page }) => {
  await setupAndPro(page, /Jannik Sinner/)
  const pro = page.getByRole('table').getByRole('columnheader').nth(1)
  await expect(pro).toContainText('Jannik Sinner')
  await expect(pro).toContainText('Head Speed (pro stock TGT 301.4)')
  await expect(pro).toContainText('Head Hawk Touch 1.30 · 28 kg')
  await expect(pro).toContainText('Medido')
  await expect(pro.getByRole('link', { name: /Fonte: Tennisnerd .*, outubro de 2025/ })).toHaveAttribute('href', /tennisnerd\.net/)
  await expect(pro).toContainText('Medido sem cordas; convertido para com cordas.')
  await expect(page.getByText('Tudo com cordas: o teu setup como o jogas')).toBeVisible()
  // 302 g bare, with the strings on.
  const w = Number((await cell(page, 'Peso', 1).textContent())!.replace(' g', '').replace(',', '.'))
  expect(w).toBeGreaterThan(315)
  expect(w).toBeLessThan(322)
  await a11y(page)
})

test('PC02 what the source does not publish is "—"; the feel only with the stock frame, as an estimate', async ({ page }) => {
  await setupAndPro(page, /Jannik Sinner/)
  for (const row of ['Twistweight', 'Recoil weight', 'Ponto doce', 'Rigidez das cordas', 'Acessórios']) {
    await expect(cell(page, row, 1)).toHaveText('—')
    await expect(cell(page, row, 0)).not.toHaveText('—')
  }
  await expect(cell(page, 'Twistweight', 2)).toHaveText('—')
  // Sinner's stock frame is in the library: the feel, estimated.
  const feel = page.getByRole('region', { name: 'Sensação' })
  // "Estimated" is said behind the card's (?).
  await feel.getByRole('button', { name: 'Informação: Sensação estimada' }).click()
  await expect(page.getByRole('dialog', { name: 'Sensação estimada' })).toContainText('Estimada a partir da raquete de série.')
  await page.keyboard.press('Escape')
  await expect(feel.getByRole('meter', { name: 'Potência: Jannik Sinner' })).toBeVisible()
  // Federer's is not: no feel at all.
  await page.getByRole('button', { name: 'Escolher outro profissional' }).click()
  await page.getByLabel('Procurar jogador').fill('federer')
  await page.getByRole('radio', { name: /Roger Federer/ }).click()
  await expect(page.getByRole('table').getByRole('columnheader').nth(1)).toContainText('Roger Federer')
  await expect(page.getByRole('region', { name: 'Sensação' })).toHaveCount(0)
})

test('PC03 in compare mode, the second place can be a pro', async ({ page }) => {
  await start(page)
  await saveSetup(page, 'Clube')
  await saveSetup(page, 'Torneio')
  await page.goto('/setups')
  await page.getByRole('button', { name: 'Comparar', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Selecionar Clube' }).check()
  await page.getByRole('region', { name: 'Comparar' }).getByRole('button', { name: 'Com um profissional' }).click()
  await expect(page.getByRole('heading', { name: 'Comparar com um profissional' })).toBeVisible()
  await expect(page.getByText('Para comparar com Clube.')).toBeVisible()
})

test('PC04 “How to get there” opens Igualar with both sides filled in, solved once', async ({ page }) => {
  await setupAndPro(page, /Novak Djokovic/)
  await page.getByRole('button', { name: 'Como chegar lá' }).click()
  await expect(page.getByRole('heading', { name: 'Planear' })).toBeVisible()
  const from = page.getByRole('region', { name: 'De onde partes' })
  await expect(from.getByLabel('Ponto de partida').locator('option:checked')).toHaveText('Torneio')
  const to = page.getByRole('region', { name: 'Onde queres chegar' })
  await expect(to.getByRole('button', { name: /^Igualar a/ })).toContainText('Novak Djokovic')
  await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('353')
  // Solved straight away.
  await expect(page.getByRole('region', { name: 'Plano de chumbo' })).toBeVisible()
  // A reload does not solve again.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Plano de chumbo' })).toHaveCount(0)
})

test('PC05 without Pro: whose racket it is, not its numbers; picking one opens Pro on that pro', async ({ page }) => {
  await start(page)
  await saveSetup(page, 'Torneio')
  await page.goto('/setups')
  await page.getByRole('button', { name: 'Mais ações: Torneio' }).click()
  await page.getByRole('menuitem', { name: 'Comparar com um profissional' }).click()
  const sinner = page.getByRole('radio', { name: /Jannik Sinner/ })
  await expect(sinner).toContainText('Head Speed')
  await expect(sinner).toContainText('Pro')
  await expect(sinner).not.toContainText('SW')
  await sinner.click()
  const sheet = page.getByRole('dialog', { name: 'SwingMath Pro' })
  await expect(sheet).toBeVisible()
  // No comparison with the pro's numbers: the only table is the plans', in the sheet.
  await expect(page.getByRole('table')).toHaveCount(1)
  await expect(sheet.getByRole('table', { name: 'O que tens no Grátis e no Pro' })).toBeVisible()
})
