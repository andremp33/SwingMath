import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

/** Every spec fails on console errors and 5xx responses. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('response', (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`)
      })
      await use(errors)
      expect(errors, 'console errors / 5xx').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** Starts the app in Portuguese, optionally with Pro unlocked. */
export async function start(page: Page, opts: { pro?: boolean; lang?: 'pt' | 'en' | 'es'; path?: string } = {}) {
  await page.addInitScript(
    ([pro, lang]) => {
      // The result table, folded on phones, starts open: the specs read it.
      if (localStorage.getItem('swingmath-open:result') === null) localStorage.setItem('swingmath-open:result', '1')
      if (!localStorage.getItem('swingmath'))
        localStorage.setItem(
          'swingmath',
          // Past the first launch's walkthrough, which has its own tests.
          JSON.stringify({ state: { lang, onboarded: true, license: pro ? { provider: 'dev', activatedAt: 1 } : null }, version: 1 }),
        )
    },
    [opts.pro ?? false, opts.lang ?? 'pt'] as const,
  )
  await page.goto(opts.path ?? '/')
  // Up once it has saved its first state (the launch starts the Pro
  // reminder's clock): what a test writes after that is not overwritten.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('swingmath') ?? '{}').state?.proNudgeAt ?? null)).not.toBeNull()
}

export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const v = r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(v, 'accessibility violations').toEqual([])
}

/** Result card value for a spec label, e.g. resultValue(page, 'Peso'). */
export function resultCard(page: Page) {
  return page.getByRole('region', { name: 'Resultado' })
}

export async function saveSetup(page: Page, name: string) {
  await page.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nome do setup').fill(name)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  // The save is done once the calculator says it is editing that setup.
  await expect(page.getByText(`A editar: ${name.trim().slice(0, 60) || 'Setup'}`, { exact: false })).toBeVisible()
}

/** Opens a collapsible section (closed by default on phones). */
export async function expand(page: Page, name: string) {
  // On the page first: the app renders once its language has loaded.
  const region = page.getByRole('region', { name })
  await region.first().waitFor()
  const closed = region.locator('button[aria-expanded="false"]')
  if (await closed.count()) await closed.first().click()
}

/** One of a saved setup's actions, from its card's "⋯" menu. */
export async function setupAction(page: Page, setupName: string, action: string) {
  await page.getByRole('button', { name: `Mais ações: ${setupName}` }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: action, exact: true }).click()
}

/** Lead at a position the way a player adds it: pick its spot on the racket,
 *  then tap + (or − for a negative n) beside it. */
export async function tapLead(page: Page, name: string, n = 1) {
  await page.getByRole('slider', { name, exact: true }).click()
  const button = page.getByRole('button', { name: `${n < 0 ? '−' : '+'} 0,5 g ${name}`, exact: true })
  for (let i = 0; i < Math.abs(n); i++) await button.click()
}

/** Planear's target, from its one picker: a setup, a racket, a pro or the
 *  catalogue, searched first when the list is long. */
export async function pickTarget(page: Page, name: string | RegExp, search?: string) {
  await page.getByRole('region', { name: 'Onde queres chegar' }).getByRole('button', { name: /^Igualar a/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Igualar a' })
  if (search) await sheet.getByRole('searchbox').fill(search)
  await sheet.getByRole('button', { name }).first().click()
  await expect(sheet).toBeHidden()
}
