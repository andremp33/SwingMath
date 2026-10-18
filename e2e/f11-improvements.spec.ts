import { periodFromSwingweight } from '../src/domain/measure'
import { a11y, expect, resultCard, saveSetup, setupAction, start, test } from './fixtures'

test.describe('F11 measuring and tuning in steps', () => {
  test('F11-H1 measure at home: pendulum swingweight goes to the calculator', async ({ page }) => {
    await start(page, { path: '/medir' })
    await page.getByLabel('Peso', { exact: true }).fill('330')
    await page.getByLabel('Equilíbrio', { exact: true }).fill('325')
    // A racket with SW 320 swings with this period; type 20 swings' worth.
    const total = (periodFromSwingweight(330, 32.5, 320) * 20).toFixed(3).replace('.', ',')
    await page.getByLabel(/Ou escreve o tempo total/).fill(total)
    await page.getByRole('button', { name: 'Juntar tentativa' }).click()
    // Whole points, and a ± that counts timing, balance and weight.
    await expect(page.getByTestId('measured-sw')).toHaveText('320')
    await expect(page.getByText(/^± \d+$/)).toBeVisible()
    await expect(page.getByText(/^Tempo ±\d+ · equilíbrio ±\d+ · peso ±\d+$/)).toBeVisible()
    await expect(page.getByText('Faz 3 tentativas')).toBeVisible()
    await a11y(page)
    await page.getByRole('button', { name: 'Usar na calculadora' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Usar specs de fábrica' })).toBeVisible()
    await expect(resultCard(page)).toContainText('330')
    await expect(resultCard(page)).toContainText('320')
  })

  test('F11-E1 the tap timer records a trial', async ({ page }) => {
    await start(page, { path: '/medir' })
    await page.getByRole('button', { name: 'Começar' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Parar' }).click()
    await expect(page.getByText(/^Tentativa 1:/)).toBeVisible()
    await page.getByRole('button', { name: 'Remover tentativa 1' }).click()
    await expect(page.getByText(/^Tentativa 1:/)).toHaveCount(0)
  })

  test('F11-E2 a trial counted one swing off is flagged and can be left out', async ({ page }) => {
    await start(page, { path: '/medir' })
    await page.getByLabel('Peso', { exact: true }).fill('320')
    await page.getByLabel('Equilíbrio', { exact: true }).fill('320')
    // The instructions are on screen.
    await expect(page.getByText('nunca de lado (de lado mede-se SW + TW)', { exact: false })).toBeVisible()
    await expect(page.getByText('20 oscilações completas (ida e volta), 3 vezes.')).toBeVisible()
    const T = periodFromSwingweight(320, 32, 320)
    // The third: 21 swings counted as 20.
    for (const total of [T * 19.98, T * 20.02, T * 21]) {
      await page.getByLabel(/Ou escreve o tempo total/).fill(total.toFixed(3).replace('.', ','))
      await page.getByRole('button', { name: 'Juntar tentativa' }).click()
    }
    await expect(page.getByText('Talvez tenhas contado uma oscilação a mais ou a menos.')).toHaveCount(1)
    await expect(page.getByTestId('measured-sw')).not.toHaveText('320')
    await page.getByRole('button', { name: 'Não contar a tentativa 3' }).click()
    await expect(page.getByTestId('measured-sw')).toHaveText('320')
    await expect(page.getByRole('button', { name: 'Voltar a contar a tentativa 3' })).toBeVisible()
    await a11y(page)
  })

  test('F11-N1 measuring needs weight and balance first', async ({ page }) => {
    await start(page, { path: '/medir' })
    await expect(page.getByText('Preenche primeiro o peso e o equilíbrio.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Usar na calculadora' })).toBeDisabled()
  })

  test('F11-H2 a measurement becomes the new starting point', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await page.getByRole('button', { name: 'Confirmar com a minha medição' }).click()
    const card = page.getByRole('region', { name: 'Confirmar com a minha medição' })
    await card.getByLabel('Peso', { exact: true }).fill('330,5')
    await card.getByRole('button', { name: 'Usar como novo ponto de partida' }).click()
    await expect(page.getByText('Chumbo total:')).toContainText('0,0 g')
    await expect(page.getByRole('button', { name: /^Só o quadro/ })).toBeVisible()
    await expect(resultCard(page)).toContainText('331')
  })
})

test.describe('F12 practical helpers', () => {
  test('F12-H1 grams become centimetres of the player\'s tape', async ({ page }) => {
    await start(page, { path: '/settings' })
    await page.getByLabel('Gramas por 10 cm').fill('4')
    await page.getByRole('link', { name: 'Calcular' }).first().click()
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await expect(page.getByText('≈ 5,0 cm de fita')).toBeVisible()
    await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
    await page.getByRole('button', { name: '+ 0,5 g 3h e 9h' }).click()
    // 1 g split in two: 0.5 g per side = 1.25 cm each.
    await expect(page.getByText('≈ 1,3 cm de fita × 2')).toBeVisible()
  })

  test('F12-H2 hit the specs of a saved setup', async ({ page }) => {
    await start(page, { pro: true })
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
    await saveSetup(page, 'Antiga')
    await page.goto('/match')
    await page.getByLabel('Igualar a um setup guardado').selectOption({ label: 'Antiga' })
    const target = page.getByRole('region', { name: 'Onde queres chegar' })
    // The setup weighs 331 g strung, and so does the starting point (the
    // racket it was saved on, as played): no conversion.
    await expect(target.getByLabel('Peso', { exact: true })).toHaveValue('331')
    // From the library's unstrung frame, the target drops the 17 g of strings.
    await page.getByLabel('Ponto de partida').selectOption({ label: 'Outra raquete da biblioteca' })
    await expect(target.getByLabel('Peso', { exact: true })).toHaveValue('314')
    await expect(target).toContainText('Medida com cordas; convertemos para sem cordas')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Plano de chumbo' })).toBeVisible()
  })

  test('F12-H3 printable sheet for the stringer', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: '+ 0,5 g Garganta' }).click()
    await saveSetup(page, 'Para o Rui')
    await page.goto('/setups')
    await setupAction(page, 'Para o Rui', 'Ficha para o encordoador')
    await expect(page.getByRole('heading', { name: 'Para o Rui' })).toBeVisible()
    await expect(page.getByRole('table').first()).toContainText('Garganta')
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible()
    await a11y(page)
  })

  test('F12-E1 light theme passes the accessibility scan', async ({ page }) => {
    await start(page, { path: '/settings' })
    await page.getByRole('radio', { name: 'Claro' }).click()
    await page.getByRole('link', { name: 'Calcular' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await a11y(page)
  })
})
