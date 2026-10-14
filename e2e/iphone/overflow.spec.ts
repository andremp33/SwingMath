import { expect, saveSetup, start, test } from '../fixtures'
import type { Locator, Page } from '@playwright/test'

// On an iPhone (WebKit, 390 px), no page is wider than the screen, even with
// long string names on both sides of a hybrid.

async function pickString(scope: Locator, field: string, typed: string, option: string) {
  await scope.getByRole('combobox', { name: field }).fill(typed)
  await scope.getByRole('listbox', { name: field }).getByRole('option', { name: option, exact: true }).click()
}

/** Long names, both sides, with gauges. */
async function longHybrid(scope: Locator) {
  await pickString(scope, 'Corda', 'poly plasma', 'Signum Pro Poly Plasma')
  await scope.getByLabel('Calibre').selectOption('1.28')
  await scope.getByRole('switch', { name: 'Híbrido: cruzadas diferentes' }).click()
  await pickString(scope, 'Corda (cruzadas)', 'firestorm', 'Signum Pro Firestorm')
  await scope.getByLabel('Calibre (cruzadas)').selectOption('1.2')
}

/** What sticks out past the right edge, for the failure message. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth
    // Inside a row that scrolls sideways on purpose, or clipped by a box
    // that hides what sticks out, an element may extend past the edge.
    const inScroller = (el: HTMLElement) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.id === 'app-scroll') return false
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll') return true
      }
      return false
    }
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.right > w + 1 || r.left < -1)
      })
      .filter((el) => !el.closest('[hidden], dialog:not([open]), .sr-only') && !inScroller(el) && getComputedStyle(el).visibility !== 'hidden')
      .slice(0, 5)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent ?? '').trim().slice(0, 40)}"`
      })
    const scroller = document.getElementById('app-scroll')
    return {
      page: document.documentElement.scrollWidth - w,
      scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      wide,
    }
  })
}

test('O01 no route is wider than the iPhone’s screen', async ({ page }) => {
  test.setTimeout(90_000)
  await start(page, { path: '/diario', pro: true })
  // A racket in the journal with the long hybrid.
  await page.getByRole('button', { name: 'Nova raquete' }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova raquete' })
  await d.getByLabel('Nome', { exact: true }).fill('A minha raquete de torneio principal')
  await longHybrid(d)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByRole('region', { name: 'As tuas raquetes' })).toContainText('Poly Plasma 1,28 · 23 / Firestorm 1,20 · 23 kg')
  // A setup with the same strings.
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Cordas' })
  await card.getByRole('button', { name: /^Cordas/ }).click()
  await longHybrid(card)
  await saveSetup(page, 'Setup de torneio com nome comprido para testar')

  for (const path of ['/', '/medir', '/rackets', '/rackets/new', '/setups', '/setups/compare', '/match', '/diario', '/cordas', '/perfil', '/perfil/definicoes', '/privacidade', '/termos']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const o = await overflow(page)
    expect(o.wide, path).toEqual([])
    expect(o.page, `${path}: page ${o.wide.join(' | ')}`).toBeLessThanOrEqual(0)
    expect(o.scroller, `${path}: scroller ${o.wide.join(' | ')}`).toBeLessThanOrEqual(0)
  }
})
