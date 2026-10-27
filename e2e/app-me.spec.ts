import { a11y, expect, test } from './fixtures'
import type { Page } from '@playwright/test'

// The store app, past its first launch, without an account.
async function open(page: Page, path = '/perfil') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt', onboarded: true }, version: 5 }))
  })
  await page.goto(path)
}

/** A landscape photo, drawn by the browser: clay on the left, blue on the right. */
async function photo(page: Page, w = 900, h = 600) {
  const url = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')!
      g.fillStyle = '#a4492a'
      g.fillRect(0, 0, w / 2, h)
      g.fillStyle = '#2a64b8'
      g.fillRect(w / 2, 0, w / 2, h)
      return c.toDataURL('image/png')
    },
    [w, h] as const,
  )
  return { name: 'campo.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') }
}

async function pick(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('dialog').getByRole('button', { name: /^(Escolher|Mudar) foto$/ }).click()
  await (await chooser).setFiles(file)
}

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('swingmath')!).state.me as { name?: string; photo?: string; color?: string })

test.describe('A03 the player’s name and photo', () => {
  test('A03-H1 a name and a photo, cut square and small, kept and shown wherever the avatar is', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perfil')
    await page.getByRole('button', { name: 'Pôr nome e foto' }).click()
    const d = page.getByRole('dialog', { name: 'O teu perfil' })
    await d.getByLabel('Nome a mostrar').fill('Ana Silva')
    // Without a photo: the initials, on a colour if they choose one.
    await d.getByRole('radio', { name: 'Azul' }).click()
    await expect(d.locator('[data-avatar="initials"]')).toHaveText('AS')
    await a11y(page)

    await pick(page, await photo(page))
    await expect(d.locator('[data-avatar="photo"]')).toBeVisible()
    // With a photo there is no colour to choose, and it can be removed.
    await expect(d.getByRole('radiogroup', { name: 'Cor do avatar' })).toHaveCount(0)
    await expect(d.getByRole('button', { name: 'Remover foto' })).toBeVisible()
    await expect(d).toContainText('Fica neste aparelho.')
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(d).toBeHidden()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ana Silva')
    // The profile's header, and the top bar (phone) or the side rail (computer).
    await expect(page.locator('main [data-avatar="photo"]')).toBeVisible()
    await expect(page.locator('#app-scroll > header [data-avatar="photo"], nav [data-avatar="photo"]').filter({ visible: true })).toHaveCount(1)

    // Kept on this device, as a 256 px square JPEG.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ana Silva')
    const me = await kept(page)
    expect(me).toMatchObject({ name: 'Ana Silva', color: 'blue' })
    expect(me.photo).toMatch(/^data:image\/jpeg;base64,/)
    const seen = await page.evaluate(async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const px = (x: number) => [...g.getImageData(x, 128, 1, 1).data.slice(0, 3)]
      return { size: [img.naturalWidth, img.naturalHeight], left: px(8), right: px(248) }
    }, me.photo!)
    expect(seen.size).toEqual([256, 256])
    // The middle of the frame: clay on the left, blue on the right.
    expect(seen.left[0]).toBeGreaterThan(seen.left[2])
    expect(seen.right[2]).toBeGreaterThan(seen.right[0])
    expect(me.photo!.length).toBeLessThan(40_000)
    await a11y(page)
  })

  test('A03-H2 removing the photo leaves the initials on their colour; cancelling keeps it as it was', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Pôr nome e foto' }).click()
    const d = page.getByRole('dialog', { name: 'O teu perfil' })
    await d.getByLabel('Nome a mostrar').fill('Rui')
    await pick(page, await photo(page, 300, 500))
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.locator('main [data-avatar="photo"]')).toBeVisible()

    // Changed, then cancelled: nothing changes.
    await page.getByRole('button', { name: 'Editar perfil' }).click()
    await d.getByLabel('Nome a mostrar').fill('Outro')
    await d.getByRole('button', { name: 'Remover foto' }).click()
    await d.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rui')
    await expect(page.locator('main [data-avatar="photo"]')).toBeVisible()

    // The avatar opens it too.
    await page.getByRole('button', { name: 'Mudar a foto do perfil' }).click()
    await d.getByRole('button', { name: 'Remover foto' }).click()
    await d.getByRole('radio', { name: 'Verde' }).click()
    await d.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.locator('main [data-avatar="initials"]')).toHaveText('R')
    await expect(page.locator('main [data-avatar="initials"]')).toHaveCSS('background-color', 'rgb(47, 122, 58)')
    expect(await kept(page)).toMatchObject({ name: 'Rui', color: 'green' })
    expect((await kept(page)).photo).toBeUndefined()
  })

  test('A03-E1 a photo too large, or a file that is not one, is refused and says why', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Pôr nome e foto' }).click()
    const d = page.getByRole('dialog', { name: 'O teu perfil' })
    await pick(page, { name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(21 * 1024 * 1024, 1) })
    await expect(d.getByRole('alert')).toHaveText('Essa foto é grande demais (máximo 20 MB). Escolhe outra.')
    await pick(page, { name: 'notas.png', mimeType: 'image/png', buffer: Buffer.from('não é uma imagem') })
    await expect(d.getByRole('alert')).toHaveText('Não conseguimos abrir essa imagem. Experimenta uma foto JPEG ou PNG.')
    await expect(d.locator('[data-avatar="photo"]')).toHaveCount(0)
    // A good one after: the error goes.
    await pick(page, await photo(page))
    await expect(d.locator('[data-avatar="photo"]')).toBeVisible()
    await expect(d.getByRole('alert')).toHaveCount(0)
  })
})
