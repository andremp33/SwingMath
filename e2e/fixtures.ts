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
      if (!localStorage.getItem('swingmath'))
        localStorage.setItem(
          'swingmath',
          JSON.stringify({ state: { lang, license: pro ? { provider: 'dev', activatedAt: 1 } : null }, version: 1 }),
        )
    },
    [opts.pro ?? false, opts.lang ?? 'pt'] as const,
  )
  await page.goto(opts.path ?? '/')
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
  await dialog.getByLabel('Nome').fill(name)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  // The save is done once the calculator says it is editing that setup.
  await expect(page.getByText(`A editar: ${name.trim().slice(0, 60) || 'Setup'}`, { exact: false })).toBeVisible()
}
