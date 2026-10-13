import { a11y, expand, expect, resultCard, start, test } from './fixtures'
import type { Page } from '@playwright/test'

async function addRacket(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nova raquete' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova raquete' })
  await d.getByLabel('Nome', { exact: true }).fill(name)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
}

/** Logs a session through the quick sheet: a length chip (or "Outra"), a rating. */
async function logSession(page: Page, minutes: number, overall?: number) {
  await page.getByRole('button', { name: 'Registar sessão' }).last().click()
  const d = page.getByRole('dialog', { name: 'Sessão' })
  const lengths = d.getByRole('radiogroup', { name: 'Duração' })
  const chip = lengths.getByRole('radio', { name: `${minutes} min` })
  if (await chip.count()) await chip.click()
  else {
    await lengths.getByRole('radio', { name: 'Outra' }).click()
    await d.getByRole('textbox', { name: 'Duração' }).fill(String(minutes))
  }
  if (overall) await d.getByRole('radiogroup', { name: 'Como correu' }).getByRole('radio', { name: `${overall}/5` }).click()
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
}

test.describe('F14 journal', () => {
  test('F14-E3 picking another model keeps the new racket open', async ({ page }) => {
    await start(page, { path: '/diario' })
    await page.getByRole('button', { name: 'Nova raquete' }).first().click()
    const d = page.getByRole('dialog', { name: 'Nova raquete' })
    // Closing the model picker (Esc) leaves the racket sheet open.
    await d.getByRole('button', { name: /Babolat Pure Aero 98/ }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Modelo' })).toBeHidden()
    await expect(d).toBeVisible()
    // So does choosing a model, which then shows in the sheet.
    await d.getByRole('button', { name: /Babolat Pure Aero 98/ }).click()
    const pick = page.getByRole('dialog', { name: 'Modelo' })
    await pick.getByRole('searchbox').fill('prestige')
    await pick.getByRole('button', { name: 'Head Prestige MP (2023)' }).click()
    await expect(pick).toBeHidden()
    await expect(d.getByRole('button', { name: /Head Prestige MP/ })).toBeVisible()
    await d.getByLabel('Nome', { exact: true }).fill('Prestige de jogo')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Head Prestige MP')
  })

  test('F14-H1 first time: add a racket, then log a session', async ({ page }) => {
    await start(page, { path: '/diario' })
    await expect(page.getByText('Adiciona a tua raquete')).toBeVisible()
    await addRacket(page, 'Aero #1')
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await expect(rackets).toContainText('Aero #1')
    await expect(rackets).toContainText('Poli 23 kg')
    await expect(rackets.getByRole('meter', { name: 'Vida das cordas' })).toHaveAttribute('aria-valuenow', '100')
    await logSession(page, 120, 4)
    await expect(rackets).toContainText('2,0 h jogadas')
    const sessions = page.getByRole('region', { name: 'Sessões' })
    await expect(sessions).toContainText('Esta semana')
    await expect(sessions.getByRole('button', { name: /Treino, 120 min, .*4\/5/ })).toBeVisible()
    // Free: the analysis is a Pro feature.
    await expect(page.getByRole('region', { name: 'O que joga melhor' }).getByRole('button', { name: 'Experimentar o Pro' })).toBeVisible()
    await a11y(page)
  })

  test('F14-H2 restring keeps the racket; Pro ranks stringings', async ({ page }) => {
    await start(page, { path: '/diario', pro: true })
    await addRacket(page, 'Blade')
    await logSession(page, 60, 3)
    const rackets = page.getByRole('region', { name: 'As tuas raquetes' })
    await rackets.getByRole('button', { name: 'Encordei' }).click()
    const d = page.getByRole('dialog', { name: 'Encordoamento' })
    await expect(d).toContainText('Blade')
    await d.getByLabel('Tensão').fill('21')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(rackets.getByRole('article')).toHaveCount(1)
    await expect(rackets).toContainText('Poli 21 kg')
    await logSession(page, 60, 5)
    const best = page.getByRole('region', { name: 'O que joga melhor' }).getByRole('listitem')
    await expect(best).toHaveCount(2)
    await expect(best.first()).toContainText('Poli 21 kg')
    // The racket's history has both stringings.
    await rackets.getByRole('button', { name: 'Blade' }).click()
    await expect(page.getByRole('dialog', { name: 'Blade' }).getByRole('region', { name: 'Encordoamentos' }).getByRole('listitem')).toHaveCount(2)
  })

  test('F14-E1 strings past their life: restring now, and a dot on the tab', async ({ page }) => {
    await start(page, { path: '/diario' })
    await addRacket(page, 'Velha')
    await logSession(page, 600)
    await logSession(page, 600)
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Encordar já')
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Diário \(1\)/ })).toBeVisible()
  })

  test('F14-E2 the whole history is free', async ({ page }) => {
    await start(page, { path: '/diario' })
    await addRacket(page, 'X')
    for (let i = 0; i < 11; i++) await logSession(page, 30)
    await expect(page.getByRole('region', { name: 'Sessões' }).getByRole('listitem')).toHaveCount(11)
    await expect(page.getByText(/Mostramos as últimas/)).toHaveCount(0)
  })

  test('F14-H4 saving a setup in the calculator puts the racket in your rackets', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Nome do setup').fill('Torneio')
    // With no rackets yet, a new one is suggested.
    await expect(d.getByRole('radiogroup', { name: 'Em que raquete tua está?' }).getByRole('radio', { name: 'Nova raquete' })).toHaveAttribute('aria-checked', 'true')
    await d.getByLabel('Nome da raquete').fill('Aero de jogo')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Guardado em Aero de jogo')).toBeVisible()
    await page.goto('/rackets')
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero de jogo')
    await page.goto('/setups')
    await expect(page.getByRole('article').filter({ hasText: 'Torneio' })).toContainText('Montado em Aero de jogo')
    await page.goto('/diario')
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Poli 23 kg')
  })

  test('F14-H3 your rackets load into the calculator', async ({ page }) => {
    await start(page, { path: '/diario' })
    await addRacket(page, 'Aero de jogo')
    await page.goto('/')
    await page.getByRole('button', { name: 'Aero de jogo' }).click()
    await expect(page.getByRole('button', { name: 'Aero de jogo' })).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/rackets')
    await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Aero de jogo')
  })
})

test.describe('F15 strings, grip and arm comfort', () => {
  test('F15-H1 tension changes the stringbed stiffness', async ({ page }) => {
    await start(page)
    await expand(page, 'Cordas')
    await expand(page, 'Conforto do braço')
    const card = page.getByRole('region', { name: 'Cordas' })
    const scale = card.getByRole('meter', { name: 'Rigidez do encordoamento' })
    const before = Number(await scale.getAttribute('aria-valuenow'))
    await expect(scale).toHaveAttribute('aria-valuetext', /Médio$/)
    await card.getByLabel('Tensão').fill('26')
    await expect(async () => expect(Number(await scale.getAttribute('aria-valuenow'))).toBeGreaterThan(before)).toPass()
    // Poly at 28 kg in a 98: a firm bed, in words too.
    await card.getByLabel('Tensão').fill('28')
    await expect(scale).toHaveAttribute('aria-valuetext', /Firme$/)
    await expect(card).toContainText('Firme · mais controlo, menos potência e conforto')
    await expect(page.getByRole('region', { name: 'Conforto do braço' }).getByRole('meter')).toBeVisible()
  })

  test('F15-H2 a heat-shrink sleeve adds a size and its weight', async ({ page }) => {
    await start(page)
    await expand(page, 'Punho')
    const grip = page.getByRole('region', { name: 'Punho' })
    const weight = async () => Number((await resultCard(page).locator('.readout').first().textContent())!.replace(',', '.'))
    const before = await weight()
    await grip.getByRole('radiogroup', { name: 'Mangas termo-retráteis' }).getByRole('radio', { name: '1' }).click()
    await expect(grip).toContainText('Tamanho final: L3')
    await expect(grip).toContainText('4 3/8"')
    await expect(async () => expect(await weight()).toBeCloseTo(before + 7, 1)).toPass()
  })

  test('F15-H3 equivalent tension is free: everyone sees the answer', async ({ page }) => {
    await start(page, { path: '/cordas' })
    const result = page.getByRole('region', { name: 'Encorda a' })
    await expect(result).toContainText('23 kg')
    await expect(result.getByRole('button', { name: 'Experimentar o Pro' })).toHaveCount(0)
    await a11y(page)
  })

  test('F15-H4 equivalent tension, Pro', async ({ page }) => {
    await start(page, { path: '/cordas', pro: true })
    const result = page.getByRole('region', { name: 'Encorda a' })
    // Same racket and string: same tension.
    await expect(result).toContainText('23 kg')
    await page.getByRole('region', { name: 'Para onde vais' }).getByLabel('Material').selectOption('gut')
    // Gut is softer, so it needs more tension for the same stiffness.
    await expect(result).not.toContainText(/^23 kg/)
    const kg = Number((await result.locator('.readout').first().textContent())!.replace(',', '.').replace(' kg', ''))
    expect(kg).toBeGreaterThan(23)
  })
})

test.describe('F17 phone sections', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('F17-H1 strings start closed with a summary, open on tap, (?) explains', async ({ page }) => {
    await start(page)
    const card = page.getByRole('region', { name: 'Cordas' })
    const head = card.getByRole('button', { name: /^Cordas/ })
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(card).toContainText('Poli 23 kg · médio (rigidez')
    await head.click()
    await expect(card.getByLabel('Tensão')).toBeVisible()
    await card.getByRole('button', { name: 'Informação: Rigidez do encordoamento' }).click()
    await expect(page.getByRole('dialog', { name: 'Rigidez do encordoamento' })).toContainText('100 = cabeça de 100')
    await page.keyboard.press('Escape')
    // Remembered on the next visit.
    await page.reload()
    await expect(page.getByRole('region', { name: 'Cordas' }).getByRole('button', { name: /^Cordas/ })).toHaveAttribute('aria-expanded', 'true')
    await a11y(page)
  })

  test('F17-H2 the result bar opens the feel, which follows the lead', async ({ page }) => {
    await start(page)
    const bar = page.getByRole('button', { name: 'Sensação estimada', exact: true })
    await expect(bar).toHaveAttribute('aria-expanded', 'false')
    await bar.click()
    const feel = page.getByRole('list', { name: 'Sensação estimada' })
    await expect(feel.getByRole('listitem')).toHaveCount(6)
    // No lead yet: nothing moved.
    await expect(feel.getByRole('listitem').filter({ hasText: 'Peso de bola' })).toContainText('·')
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await expect(feel.getByRole('listitem').filter({ hasText: 'Peso de bola' })).toContainText('+')
    await expect(feel.getByRole('listitem').filter({ hasText: 'Manobrabilidade' })).toContainText('−')
    await a11y(page)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sensação estimada', exact: true })).toHaveAttribute('aria-expanded', 'true')
  })
})
