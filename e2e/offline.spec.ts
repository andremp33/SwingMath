import { expect, test } from '@playwright/test'

// Production build: after the first visit the service worker serves
// everything, so the app opens with no network.
test('OFF-H1 opens offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Calculadora|Calculator/ })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Calculadora|Calculator/ })).toBeVisible()
  await page.goto('/rackets')
  await expect(page.getByRole('article').first()).toBeVisible()
  await context.setOffline(false)
})
