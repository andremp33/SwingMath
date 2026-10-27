import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { env, REVIEW_EMAIL } from '../cloud/env'

const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const MAILPIT = 'http://127.0.0.1:54324'
let stamp = String(Date.now())
test.beforeAll(() => {
  stamp = `${Date.now()}-${test.info().project.name}`
})
const emailOf = (name: string) => `${name}-${stamp}@example.test`
/** The app shows the beta or the real subscription, depending on the build. */
const BETA_OFF = process.env.VITE_PRO_BETA === 'false'

test.afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users.filter((u) => u.email?.endsWith(`-${stamp}@example.test`))) await admin.auth.admin.deleteUser(u.id)
  await admin.from('subscriptions').delete().like('email', `%-${stamp}@example.test`)
})

/** The code is in the email subject: "SwingMath: 123456". */
async function codeFor(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const { messages } = (await res.json()) as { messages: { Subject: string; Created: string }[] }
    const fresh = messages.find((m) => Date.parse(m.Created) >= after - 2000)
    const code = fresh && /(\d{6})/.exec(fresh.Subject)?.[1]
    if (code) return code
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no code for ${email}`)
}

async function open(browser: Browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ state: { lang: 'pt', onboarded: true }, version: 3 }))
  })
  return page
}

/** The account sits at the top of the profile; the form opens on request. */
async function accountCard(page: Page) {
  await page.goto('/perfil')
  const card = page.getByRole('region', { name: 'Conta', exact: true })
  const create = card.getByRole('button', { name: 'Criar conta' })
  // Drawn once the page has loaded: the form, the button, or the account.
  await expect(create.or(card.getByLabel('Email')).or(card.getByText('Entraste como'))).toBeVisible()
  if (await create.isVisible()) await create.click()
  return card
}

/** Signs in; a new account then asks for a name and photo, put off here
 *  unless `keepWelcome`. */
async function signIn(page: Page, email: string, { keepWelcome = false } = {}) {
  const card = await accountCard(page)
  await card.getByLabel('Email').fill(email)
  const sentAt = Date.now()
  await card.getByRole('button', { name: 'Enviar código' }).click()
  await expect(card.getByText(`Enviámos um email para ${email}.`, { exact: false })).toBeVisible()
  await card.getByLabel('Código').fill(await codeFor(email, sentAt))
  await card.getByRole('button', { name: 'Entrar' }).click()
  await expect(card.getByText(`Entraste como ${email}`)).toBeVisible()
  const welcome = page.getByRole('dialog', { name: 'Como te chamamos?' })
  if (!keepWelcome && (await welcome.isVisible())) await welcome.getByRole('button', { name: 'Cancelar' }).click()
  return card
}

/** A photo drawn by the browser, picked in the open profile sheet. */
async function pickPhoto(page: Page) {
  const url = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 500
    const g = c.getContext('2d')!
    g.fillStyle = '#2a64b8'
    g.fillRect(0, 0, 500, 500)
    return c.toDataURL('image/png')
  })
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('dialog').getByRole('button', { name: /^(Escolher|Mudar) foto$/ }).click()
  await (await chooser).setFiles({ name: 'eu.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') })
  await expect(page.getByRole('dialog').locator('[data-avatar="photo"]')).toBeVisible()
}

const userByEmail = async (email: string) => (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)!

/** The first setup's share sheet, from its ⋯ menu. */
async function share(page: Page) {
  await page.getByRole('button', { name: /^Mais ações:/ }).first().click()
  await page.getByRole('menuitem', { name: 'Partilhar' }).click()
}

async function saveSetup(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: '+ 0,5 g 12h (ponta)' }).click()
  await page.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nome do setup').fill(name)
  await d.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`A editar: ${name}`)).toBeVisible()
}

test('wrong code is refused; during the beta every account has Pro', async ({ browser }) => {
  const page = await open(browser)
  const email = emailOf('free')
  const card = await accountCard(page)
  await card.getByLabel('Email').fill(email)
  await card.getByRole('button', { name: 'Enviar código' }).click()
  await card.getByLabel('Código').fill('000000')
  await card.getByRole('button', { name: 'Entrar' }).click()
  await expect(card.getByText('Código errado ou expirado.')).toBeVisible()
  await card.getByRole('button', { name: 'Usar outro email' }).click()
  // The server sends one code per address per second (max_frequency).
  await page.waitForTimeout(1100)
  await signIn(page, email)
  // Any account syncs (its backup); Pro is separate.
  await expect(card.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible()
  // Run with VITE_PRO_BETA=false, an account without a subscription has no Pro.
  if (BETA_OFF) return expect(card).toContainText('Esta conta não tem subscrição')
  await expect(card).toContainText('Pro grátis durante a beta')
})

test('Pro through the account syncs setups to a second device', async ({ browser }) => {
  const email = emailOf('pro')
  await admin.from('subscriptions').insert({ email, status: 'active' })
  const a = await open(browser)
  await saveSetup(a, 'Antes da conta')
  const cardA = await signIn(a, email)
  await expect(cardA.getByText(BETA_OFF ? 'Pro pela conta' : 'Pro grátis durante a beta, sincronização incluída.')).toBeVisible()
  await expect(cardA).toContainText(/Sincronizado (agora mesmo|há)/)

  const b = await open(browser)
  await signIn(b, email)
  await b.goto('/setups')
  await expect(b.getByRole('article').filter({ hasText: 'Antes da conta' })).toBeVisible()

  // An edit on B reaches A.
  await b.getByRole('button', { name: 'Apagar' }).first().click()
  await expect(b.getByRole('article')).toHaveCount(0)
  await b.goto('/perfil')
  await b.getByRole('button', { name: 'Sincronizar agora' }).click()
  await a.goto('/perfil')
  await a.getByRole('button', { name: 'Sincronizar agora' }).click()
  await a.goto('/setups')
  await expect(a.getByRole('article')).toHaveCount(0)
})

test('publish a setup; someone else tries it and reports it', async ({ browser }) => {
  const author = await open(browser)
  await signIn(author, emailOf('author'))
  await saveSetup(author, 'Plow extra')
  await author.goto('/setups')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await author.getByRole('dialog').getByLabel(/Assinar como/).fill('Ana')
  await author.getByRole('dialog').getByRole('checkbox', { name: 'Potência' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(author.getByText('Setup publicado')).toBeVisible()

  const visitor = await open(browser)
  await visitor.goto('/')
  const card = visitor.getByRole('region', { name: 'Comunidade' })
  await openCommunity(visitor)
  const row = card.getByRole('listitem').filter({ hasText: 'Plow extra' })
  await expect(row).toContainText('Ana')
  await expect(row).toContainText('12h 0,5 g')
  // Trying it on can be undone; it counts only once it is saved.
  await row.getByRole('button', { name: 'Experimentar' }).click()
  await expect(visitor.getByText('Setup carregado na calculadora')).toBeVisible()
  await expect(visitor.getByRole('slider', { name: '12h (ponta)' })).toHaveAttribute('aria-valuetext', '0,5 g')
  await visitor.getByRole('button', { name: 'Anular' }).click()
  await expect(visitor.getByRole('slider', { name: '12h (ponta)' })).toHaveAttribute('aria-valuetext', '0,0 g')
  const copies = async () => (await admin.from('public_setups').select('copies').eq('name', 'Plow extra').eq('author', 'Ana')).data?.[0]?.copies
  expect(await copies()).toBe(0)
  await row.getByRole('button', { name: 'Experimentar' }).click()
  await visitor.getByRole('button', { name: /^(Guardar setup|Guardar como novo)$/ }).first().click()
  await visitor.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(copies).toBe(1)
  await visitor.goto('/')
  await openCommunity(visitor)
  await expect(row).toContainText('guardado por 1')
  // Reporting needs an account.
  await row.getByRole('button', { name: /Denunciar/ }).click()
  await expect(visitor.getByText('Precisas de conta para isto.')).toBeVisible()
  // Hiding an author needs none, and keeps their setups out of sight.
  await row.getByRole('button', { name: 'Esconder este autor: Ana' }).click()
  await expect(visitor.getByText('Não vais ver mais setups deste autor.')).toBeVisible()
  await expect(card.getByRole('listitem').filter({ hasText: 'Plow extra' })).toHaveCount(0)
})

test('a report says why, and three of them hide the recipe from everyone but its author', async ({ browser }) => {
  test.setTimeout(120_000)
  const name = `Denunciada ${stamp}`
  const author = await open(browser)
  await signIn(author, emailOf('reported'))
  await saveSetup(author, name)
  await author.goto('/setups')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('checkbox', { name: 'Spin' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(author.getByText('Setup publicado')).toBeVisible()
  const { data } = await admin.from('public_setups').select('id').eq('name', name).single()

  // One report through the app, with its reason; two more straight to the database.
  const reporter = await open(browser)
  await signIn(reporter, emailOf('reporter'))
  await reporter.goto('/')
  const row = (await openCommunity(reporter)).getByRole('listitem').filter({ hasText: name })
  await row.getByRole('button', { name: `Denunciar ${name}` }).click()
  await row.getByRole('radio', { name: 'Números falsos' }).click()
  await a11y(reporter, '#card-community')
  await row.getByRole('button', { name: 'Denunciar', exact: true }).click()
  await expect(reporter.getByText('Obrigado. Vamos rever.')).toBeVisible()
  for (const n of ['rep2', 'rep3']) {
    const { data: u } = await admin.auth.admin.createUser({ email: emailOf(n), email_confirm: true })
    await admin.from('reports').insert({ setup_id: data!.id, user_id: u.user!.id, reason: 'spam' })
  }
  const queue = await admin.from('moderation_queue').select('reasons').eq('id', data!.id).single()
  expect(queue.data?.reasons).toEqual(['false', 'spam', 'spam'])

  await reporter.reload()
  await openCommunity(reporter)
  await expect(reporter.getByRole('region', { name: 'Comunidade' }).getByRole('listitem').filter({ hasText: name })).toHaveCount(0)
  await author.goto('/')
  const mine = (await openCommunity(author)).getByRole('listitem').filter({ hasText: name })
  await expect(mine).toContainText('Escondido depois de denúncias')
})

test('a name with an insult is not published', async ({ browser }) => {
  const author = await open(browser)
  await signIn(author, emailOf('rude'))
  await saveSetup(author, `Setup de merda ${stamp}`)
  await author.goto('/setups')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('checkbox', { name: 'Potência' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(author.getByText('O nome ou a assinatura têm palavras que não publicamos.', { exact: false })).toBeVisible()
  expect((await admin.from('public_setups').select('id').eq('name', `Setup de merda ${stamp}`)).data).toEqual([])
})

/** No WCAG A/AA problems inside one part of the page. */
async function a11y(page: Page, selector: string) {
  const r = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
}

/** The calculator's community card, opened. */
async function openCommunity(page: Page) {
  const card = page.getByRole('region', { name: 'Comunidade' })
  const toggle = card.getByRole('button', { name: /^Comunidade/ })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  return card
}

test('a recipe says what it is for, filters by goal, and republishing updates it', async ({ browser }) => {
  // Three players and two pages of the app: longer than the default.
  test.setTimeout(90_000)
  const author = await open(browser)
  await signIn(author, emailOf('recipe'))
  await saveSetup(author, `Estável ${stamp}`)
  await author.goto('/setups')
  await share(author)
  const d = author.getByRole('dialog')
  await d.getByRole('button', { name: 'Publicar na comunidade' }).click()
  // A goal is required.
  await d.getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(d.getByRole('alert')).toHaveText('Escolhe pelo menos um objetivo.')
  await d.getByRole('checkbox', { name: 'Estabilidade' }).click()
  await d.getByLabel('Nível').selectOption({ label: 'Avançado' })
  await a11y(author, 'dialog[open]')
  await d.getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(author.getByText('Setup publicado')).toBeVisible()

  // Publishing the same setup again updates the recipe.
  await author.keyboard.press('Escape')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('checkbox', { name: 'Conforto' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await expect(author.getByText('Setup atualizado na comunidade')).toBeVisible()
  const rows = await admin.from('public_setups').select('goals, level').eq('name', `Estável ${stamp}`)
  expect(rows.data).toEqual([{ goals: ['stability', 'comfort'], level: 'advanced' }])

  const visitor = await open(browser)
  await visitor.goto('/')
  await visitor.getByRole('button', { name: /setups? da comunidade para esta raquete/ }).click()
  const card = visitor.getByRole('region', { name: 'Comunidade' })
  await expect(card.getByRole('button', { name: /^Comunidade/ })).toHaveAttribute('aria-expanded', 'true')
  await card.getByRole('radio', { name: 'Estabilidade' }).click()
  const row = card.getByRole('listitem').filter({ hasText: `Estável ${stamp}` })
  await expect(row).toContainText('Avançado')
  await expect(row).toContainText('Base de catálogo')
  await a11y(visitor, '#card-community')
  await row.getByRole('button', { name: 'Experimentar' }).click()
  await expect(visitor.getByRole('slider', { name: '12h (ponta)' })).toHaveAttribute('aria-valuetext', '0,5 g')

  // The library says how many recipes a frame has, and opens them.
  const lib = await open(browser)
  await lib.goto('/rackets')
  await lib.getByRole('button', { name: /setups? ?: Ver os setups da comunidade para a Babolat Pure Aero 98$/ }).first().click()
  await expect(lib.getByRole('heading', { name: 'Calculadora' })).toBeVisible()
  await expect(lib.getByRole('region', { name: 'Comunidade' }).getByRole('button', { name: /^Comunidade/ })).toHaveAttribute('aria-expanded', 'true')
})

test('a setup moved to another racket moves its recipe; a hidden one stays put', async ({ browser }) => {
  test.setTimeout(90_000)
  const name = `Muda ${stamp}`
  const author = await open(browser)
  await signIn(author, emailOf('mover'))
  await saveSetup(author, name)
  await author.goto('/setups')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('checkbox', { name: 'Controlo' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Publicar na comunidade' }).click()
  await expect(author.getByText('Setup publicado')).toBeVisible()
  const before = await admin.from('public_setups').select('id, racket_id').eq('name', name)
  expect(before.data).toHaveLength(1)
  await admin.rpc('count_copy', { setup_id: before.data![0].id })

  // The same setup, now on a Prestige.
  await author.goto('/')
  await expect(author.getByText(`A editar: ${name}`)).toBeVisible()
  // On one of the player's rackets, the picker is named after it.
  await author.getByRole('button', { name: /^(Raquete|Modelo da .+) Babolat Pure Aero 98/ }).first().click()
  await author.getByRole('dialog').getByRole('searchbox').fill('prestige')
  await author.getByRole('dialog').getByRole('button', { name: 'Head Prestige MP (2023)' }).click()
  await author.getByRole('button', { name: 'Atualizar setup' }).click()
  await expect(author.getByText('Setup atualizado', { exact: true })).toBeVisible()
  await author.goto('/setups')
  await expect(author.getByRole('article').filter({ hasText: name })).toContainText('Prestige MP')
  await share(author)
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await expect(author.getByText('Setup publicado na raquete nova; saiu da antiga')).toBeVisible()
  const after = await admin.from('public_setups').select('id, racket_id, copies, goals').eq('name', name)
  expect(after.data).toHaveLength(1)
  expect(after.data![0].racket_id).toContain('prestige')
  expect(after.data![0].racket_id).not.toBe(before.data![0].racket_id)
  // Another recipe: copies start again, the goals carry over.
  expect(after.data![0]).toMatchObject({ copies: 0, goals: ['control'] })

  // Hidden by reports: the author is told, and cannot publish it again.
  await admin.from('public_setups').update({ hidden: true }).eq('id', after.data![0].id)
  await author.keyboard.press('Escape')
  await share(author)
  await expect(author.getByRole('dialog').getByText('Este setup foi escondido depois de denúncias', { exact: false })).toBeVisible()
  await expect(author.getByRole('dialog').getByRole('button', { name: /na comunidade$/ })).toHaveCount(0)
  await author.keyboard.press('Escape')
  await author.getByRole('article').filter({ hasText: name }).getByRole('button', { name: `Abrir: ${name}` }).click()
  const mine = (await openCommunity(author)).getByRole('listitem').filter({ hasText: name })
  await expect(mine).toContainText('Escondido depois de denúncias: só tu o vês até o revermos.')
  await expect(mine.getByRole('button', { name: 'Atualizar' })).toHaveCount(0)
  const still = await admin.from('public_setups').select('id, hidden').eq('name', name)
  expect(still.data).toEqual([{ id: after.data![0].id, hidden: true }])
})

test('the review account signs in with a password; nobody else sees the field', async ({ browser }) => {
  // A throwaway password for the local stack, made here, never a real one.
  const password = `review-${stamp}-${Math.random().toString(36).slice(2)}`
  const { data } = await admin.auth.admin.createUser({ email: REVIEW_EMAIL, password, email_confirm: true })
  try {
    const page = await open(browser)
    const card = await accountCard(page)
    await card.getByLabel('Email').fill(emailOf('someone'))
    await expect(card.getByLabel('Palavra-passe')).toHaveCount(0)
    await card.getByLabel('Email').fill(REVIEW_EMAIL)
    await card.getByLabel('Palavra-passe').fill(password)
    await card.getByRole('button', { name: 'Entrar' }).click()
    await expect(card.getByText(`Entraste como ${REVIEW_EMAIL}`)).toBeVisible()
  } finally {
    if (data.user) await admin.auth.admin.deleteUser(data.user.id)
  }
})

test('measurements: the median shows from 3 players, then account deletion', async ({ browser }) => {
  const rid = 'stock-babolat-pure-aero-98-2026'
  // Two other players already measured this frame.
  const others: [string, number][] = [
    ['m1', 321],
    ['m2', 325],
  ]
  for (const [n, w] of others) {
    const { data } = await admin.auth.admin.createUser({ email: emailOf(n), email_confirm: true })
    await admin.from('measurements').insert({ user_id: data.user!.id, racket_id: rid, strung: true, weight_g: w })
  }
  const page = await open(browser)
  await signIn(page, emailOf('measurer'))
  await page.goto('/medir')
  await page.getByRole('textbox', { name: 'Peso' }).fill('323')
  const share = page.getByRole('region', { name: 'Partilhar com a comunidade' })
  await share.getByRole('button', { name: 'Partilhar com a comunidade' }).click()
  await expect(page.getByText('Obrigado! A tua medição foi partilhada.')).toBeVisible()
  await page.goto('/')
  const card = await openCommunity(page)
  await expect(card).toContainText(/3 jogadores mediram esta raquete com cordas/)
  await expect(card).toContainText('323,0 g')

  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Apagar conta' }).click()
  await page.getByRole('button', { name: 'Apagar conta para sempre' }).click()
  await expect(page.getByText('Conta apagada')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conta', exact: true }).getByRole('button', { name: 'Criar conta' })).toBeVisible()
  const left = await admin.from('measurements').select('id').eq('racket_id', rid).eq('weight_g', 323)
  expect(left.data).toEqual([])
})

test('a new account asks for a name and photo; a second device gets them, and a removal travels back', async ({ browser }) => {
  const email = emailOf('me')
  const a = await open(browser)
  await signIn(a, email, { keepWelcome: true })
  const welcome = a.getByRole('dialog', { name: 'Como te chamamos?' })
  await welcome.getByLabel('Nome a mostrar').fill('Ana Silva')
  await pickPhoto(a)
  await expect(welcome).toContainText('Fica na tua conta, em todos os teus aparelhos.')
  await welcome.getByRole('button', { name: 'Guardar' }).click()
  await expect(a.getByRole('heading', { level: 1 })).toHaveText('Ana Silva')

  // On the account: the name and the photo's stamp, and the photo in Storage.
  const id = (await userByEmail(email)).id
  await expect.poll(async () => (await admin.auth.admin.getUserById(id)).data.user?.user_metadata.display_name, { timeout: 15_000 }).toBe('Ana Silva')
  expect(typeof (await admin.auth.admin.getUserById(id)).data.user?.user_metadata.avatar.photo).toBe('number')
  expect((await admin.storage.from('avatars').list(id)).data?.map((f) => f.name)).toEqual(['avatar.jpg'])

  // A second device: not asked again, and shows them.
  const b = await open(browser)
  await signIn(b, email, { keepWelcome: true })
  await expect(b.getByRole('dialog', { name: 'Como te chamamos?' })).toHaveCount(0)
  await expect(b.getByRole('heading', { level: 1 })).toHaveText('Ana Silva')
  await expect(b.locator('main [data-avatar="photo"]')).toBeVisible()

  // The photo removed there: gone from Storage, and from the first device.
  await b.getByRole('button', { name: 'Editar perfil' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Remover foto' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(async () => (await admin.storage.from('avatars').list(id)).data?.length, { timeout: 15_000 }).toBe(0)
  await a.goto('/perfil')
  await expect(a.locator('main [data-avatar="initials"]')).toHaveText(/^AS/)

  // Deleting the account deletes the photo too.
  await a.getByRole('button', { name: 'Editar perfil' }).click()
  await pickPhoto(a)
  await a.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(async () => (await admin.storage.from('avatars').list(id)).data?.length, { timeout: 15_000 }).toBe(1)
  await a.getByRole('button', { name: 'Apagar conta' }).click()
  await a.getByRole('button', { name: 'Apagar conta para sempre' }).click()
  await expect(a.getByText('Conta apagada')).toBeVisible()
  expect((await admin.storage.from('avatars').list(id)).data).toEqual([])
  // This device keeps its own copy.
  await expect(a.getByRole('heading', { level: 1 })).toHaveText('Ana Silva')
})

test('the account’s email changes with the codes sent to the new and the current email', async ({ browser }) => {
  const old = emailOf('old')
  const next = emailOf('new')
  const page = await open(browser)
  const card = await signIn(page, old)
  // The sign-in's code must not pass for the change's (codeFor looks back 2 s).
  await page.waitForTimeout(2500)
  await card.getByRole('button', { name: 'Mudar email' }).click()
  const d = page.getByRole('dialog', { name: 'Mudar o email da conta' })
  await d.getByLabel('Email novo').fill(old)
  await d.getByRole('button', { name: 'Enviar código' }).click()
  await expect(d.getByText('É o email que já tens.')).toBeVisible()
  await d.getByLabel('Email novo').fill(next)
  const sentAt = Date.now()
  await d.getByRole('button', { name: 'Enviar código' }).click()
  // Secure email change: a code to each address, both typed.
  await d.getByLabel(`Código enviado para ${next}`).fill(await codeFor(next, sentAt))
  await d.getByLabel(`Código enviado para ${old}`).fill(await codeFor(old, sentAt))
  await d.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(`Email mudado para ${next}`)).toBeVisible()
  await expect(card.getByText(`Entraste como ${next}`)).toBeVisible()
  await expect(page.locator('main header')).toContainText(next)
  expect(await userByEmail(next)).toBeTruthy()
})
