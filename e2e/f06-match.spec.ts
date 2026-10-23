import { a11y, expect, start, test } from './fixtures'

test.describe('F06 hit a target', () => {
  test('F06-H1 finds lead to reach a target', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    const target = page.getByRole('region', { name: 'Onde queres chegar' })
    await target.getByLabel('Peso', { exact: true }).fill('320')
    await target.getByLabel('Swingweight').fill('300')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    const plan = page.getByRole('region', { name: 'Plano de chumbo' })
    await expect(plan).toContainText('Chumbo total')
    await expect(plan).toContainText(/9\d(,\d)?% de correspondência|100% de correspondência/)
    await a11y(page)
  })

  test('F06-E1 target lighter than the frame is flagged', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('region', { name: 'Onde queres chegar' }).getByLabel('Peso', { exact: true }).fill('290')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByText(/Não dá para chegar a este alvo/)).toBeVisible()
  })

  test('F06-N1 empty target asks for a value', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Preenche pelo menos um valor do alvo.')
  })

  test('FIX-5 a wrong input spends nothing', async ({ page }) => {
    await start(page, { path: '/match' })
    // One count for both modes, not one per tab.
    await expect(page.getByText('3 planos grátis')).toHaveCount(1)
    await expect(page.getByRole('radio', { name: /Atingir um alvo/ })).not.toContainText('grátis')
    // No target: an error, not a plan.
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Preenche pelo menos um valor do alvo.')
    await expect(page.getByText('3 planos grátis')).toBeVisible()
    // Matching racquets with only one of them: an error too.
    await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('3 planos grátis')).toBeVisible()
  })

  test('FIX-6 the same plan again spends nothing: other positions, another limit, the typed target fine-tuned', async ({ page }) => {
    await start(page, { path: '/match' })
    const target = page.getByRole('region', { name: 'Onde queres chegar' })
    const run = page.getByRole('button', { name: 'Calcular', exact: true })
    await target.getByLabel('Peso', { exact: true }).fill('320')
    await run.click()
    await expect(page.getByRole('region', { name: 'Plano de chumbo' })).toContainText('Chumbo total')
    await expect(page.getByText('2 planos grátis')).toBeVisible()
    await page.getByRole('button', { name: '12h (ponta)', exact: true }).click()
    await page.getByLabel('Máximo por posição').fill('6')
    await run.click()
    await target.getByLabel('Peso', { exact: true }).fill('322')
    await run.click()
    await expect(page.getByRole('region', { name: 'Plano de chumbo' })).toContainText('Chumbo total')
    await expect(page.getByText('2 planos grátis')).toBeVisible()
  })

  test('FIX-7 the fourth new plan shows its diagnosis; the plan per position is Pro', async ({ page }) => {
    await start(page, { path: '/match' })
    const target = page.getByRole('region', { name: 'Onde queres chegar' })
    const plan = page.getByRole('region', { name: 'Plano de chumbo' })
    const run = page.getByRole('button', { name: 'Calcular', exact: true })
    await target.getByRole('radio', { name: 'Profissional' }).click()
    for (const player of ['Novak Djokovic', 'Rafael Nadal', 'Roger Federer']) {
      await target.getByRole('radio', { name: new RegExp(player) }).click()
      await run.click()
      await expect(plan).toContainText('Chumbo total')
    }
    await expect(page.getByText('Pro', { exact: true })).toBeVisible()
    // A fourth: what is missing, whether lead gets there, where it lands.
    await target.getByRole('radio', { name: /Thiago Seyboth Wild/ }).click()
    await run.click()
    await expect(plan).toContainText('Falta')
    await expect(plan).toContainText(/Peso \+\d+ g/)
    await expect(plan).toContainText('Fica com')
    await expect(plan).toContainText(/Dá para lá chegar|não chega lá/)
    await expect(plan).not.toContainText('Chumbo total')
    await expect(plan.getByRole('button', { name: 'Abrir na calculadora' })).toHaveCount(0)
    await expect(plan).toContainText('O plano por posição é Pro')
    await plan.getByRole('button', { name: 'Experimentar o Pro' }).click()
    await expect(page.getByRole('dialog', { name: 'SwingMath Pro' })).toContainText('Usaste os 3 planos grátis do Planear.')
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    // One of the three again: whole.
    await target.getByRole('radio', { name: /Rafael Nadal/ }).click()
    await run.click()
    await expect(plan).toContainText('Chumbo total')
    await a11y(page)
  })

  test('F06-E2 open the plan in the calculator', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('region', { name: 'Onde queres chegar' }).getByLabel('Peso', { exact: true }).fill('315')
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir na calculadora' }).click()
    await expect(page.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
    // The frame starts at 305 g unstrung (Babolat's figure), so 315 g needs 10 g of lead.
    await expect(page.getByText('Chumbo total:')).toContainText('10,0 g')
  })
})

test.describe('F07 match rackets', () => {
  test('F07-H1 two rackets get a common target', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
    for (const q of ['speed mp', 'radical mp']) {
      await page.getByRole('button', { name: 'Raquete Procurar marca ou modelo' }).first().click()
      await page.getByRole('dialog').getByRole('searchbox').fill(q)
      await page.getByRole('dialog').getByRole('listitem').first().getByRole('button').click()
    }
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Alvo comum' })).toBeVisible()
    await expect(page.getByRole('region', { name: /Raquete [12]/ }).filter({ hasText: 'Chumbo total' })).toHaveCount(2)
    await a11y(page)
  })

  test('F07-N1 missing racket shows an error', async ({ page }) => {
    await start(page, { pro: true, path: '/match' })
    await page.getByRole('radio', { name: /Igualar raquetes/ }).click()
    await page.getByRole('button', { name: 'Calcular', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('Pro targets', () => {
  test('F06-H5 a pro target, converted to the state of the starting point, with its source', async ({ page }) => {
    await start(page, { path: '/match' })
    const to = page.getByRole('region', { name: 'Onde queres chegar' })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await to.getByRole('radio', { name: /Rafael Nadal/ }).click()
    // Library values are unstrung, so Nadal's strung 337 g loses the 17 g of strings.
    await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('320')
    await expect(to).toContainText('Medida com cordas; convertemos para sem cordas')
    // Measured or reported, by whom and when, with the link.
    await expect(to.getByRole('radio', { name: /Rafael Nadal/ })).toContainText('Medido')
    await expect(to).toContainText('Medido: Medido por um laboratório, encordoador, loja ou autor identificados.')
    await expect(to.getByRole('link', { name: /Fonte: Tennis Warehouse \(lab\), junho de 2023/ })).toHaveAttribute('href', /tennis-warehouse\.com/)
    await expect(to).toContainText('Specs publicados; o SwingMath não tem relação com os jogadores nem com as marcas.')
    await a11y(page)
  })

  test('F06-H7 search, ATP and WTA apart, and the stock racquet to start from', async ({ page }) => {
    await start(page, { path: '/match' })
    const to = page.getByRole('region', { name: 'Onde queres chegar' })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await expect(to.getByRole('radiogroup', { name: 'Profissional ATP' })).toBeVisible()
    const wta = to.getByRole('radiogroup', { name: 'Profissional WTA' })
    await expect(wta.getByRole('radio', { name: /Iga Świątek/ })).toContainText('Reportado')
    // Searching ignores accents and case.
    await to.getByLabel('Procurar jogador').fill('swiatek')
    await expect(to.getByRole('radiogroup', { name: 'Profissional ATP' })).toHaveCount(0)
    await expect(wta.getByRole('radio')).toHaveCount(1)
    await to.getByLabel('Procurar jogador').fill('zzz')
    await expect(to).toContainText('Nenhum jogador com esse nome.')
    // Sinner: his strings, and his stock racquet as the starting point.
    await to.getByLabel('Procurar jogador').fill('sinner')
    await to.getByRole('radio', { name: /Jannik Sinner/ }).click()
    await expect(to).toContainText('Cordas: Head Hawk Touch 1.30 · 28 kg')
    await expect(to.getByRole('link', { name: /Fonte: Tennisnerd/ })).toBeVisible()
    await to.getByRole('button', { name: 'Partir da raquete de série' }).click()
    const from = page.getByRole('region', { name: 'De onde partes' })
    await expect(from.getByRole('button', { name: /Head Speed MP \(2026\)/ })).toBeVisible()
    // Both unstrung: Sinner's numbers as measured.
    await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('302')
    await a11y(page)
  })

  test('F06-H6 from the calculator with strings on, the target stays strung', async ({ page }) => {
    await start(page, { path: '/match' })
    await page.getByLabel('Ponto de partida').selectOption({ label: 'Da calculadora' })
    const to = page.getByRole('region', { name: 'Onde queres chegar' })
    await to.getByRole('radio', { name: 'Profissional' }).click()
    await to.getByRole('radio', { name: /Roger Federer/ }).click()
    await expect(to.getByLabel('Peso', { exact: true })).toHaveValue('357')
    await expect(to).toContainText('com cordas')
  })
})
