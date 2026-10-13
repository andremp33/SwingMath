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
  const card = page.getByRole('region', { name: 'Conta' })
  const create = card.getByRole('button', { name: 'Criar conta' })
  if (await create.isVisible()) await create.click()
  return card
}

async function signIn(page: Page, email: string) {
  const card = await accountCard(page)
  await card.getByLabel('Email').fill(email)
  const sentAt = Date.now()
  await card.getByRole('button', { name: 'Enviar código' }).click()
  await expect(card.getByText(`Enviámos um email para ${email}.`, { exact: false })).toBeVisible()
  await card.getByLabel('Código').fill(await codeFor(email, sentAt))
  await card.getByRole('button', { name: 'Entrar' }).click()
  await expect(card.getByText(`Entraste como ${email}`)).toBeVisible()
  return card
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
  // Run with VITE_PRO_BETA=false, an account without a subscription has no Pro.
  if (BETA_OFF) return expect(card).toContainText('Esta conta não tem subscrição')
  await expect(card).toContainText('Pro grátis durante a beta')
  await expect(card.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible()
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
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
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
  await row.getByRole('button', { name: 'Experimentar' }).click()
  await expect(visitor.getByText('Setup carregado na calculadora')).toBeVisible()
  await expect(visitor.getByRole('slider', { name: '12h (ponta)' })).toHaveValue('0.5')
  // Reporting needs an account.
  await row.getByRole('button', { name: /Denunciar/ }).click()
  await expect(visitor.getByText('Precisas de conta para isto.')).toBeVisible()
  // Hiding an author needs none, and keeps their setups out of sight.
  await row.getByRole('button', { name: 'Esconder este autor: Ana' }).click()
  await expect(visitor.getByText('Não vais ver mais setups deste autor.')).toBeVisible()
  await expect(card.getByRole('listitem').filter({ hasText: 'Plow extra' })).toHaveCount(0)
})

test('a name with an insult is not published', async ({ browser }) => {
  const author = await open(browser)
  await signIn(author, emailOf('rude'))
  await saveSetup(author, `Setup de merda ${stamp}`)
  await author.goto('/setups')
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
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
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
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
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
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
  await expect(visitor.getByRole('slider', { name: '12h (ponta)' })).toHaveValue('0.5')

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
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
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
  await author.getByRole('button', { name: /Raquete Babolat Pure Aero 98/ }).first().click()
  await author.getByRole('dialog').getByRole('searchbox').fill('prestige')
  await author.getByRole('dialog').getByRole('button', { name: 'Head Prestige MP (2023)' }).click()
  await author.getByRole('button', { name: 'Atualizar setup' }).click()
  await expect(author.getByText('Setup atualizado', { exact: true })).toBeVisible()
  await author.goto('/setups')
  await expect(author.getByRole('article').filter({ hasText: name })).toContainText('Prestige MP')
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await expect(author.getByText('Setup publicado na raquete nova; saiu da antiga')).toBeVisible()
  const after = await admin.from('public_setups').select('id, racket_id, copies, goals').eq('name', name)
  expect(after.data).toHaveLength(1)
  expect(after.data![0].racket_id).toContain('prestige')
  expect(after.data![0].racket_id).not.toBe(before.data![0].racket_id)
  // Another recipe: copies start again, the goals carry over.
  expect(after.data![0]).toMatchObject({ copies: 0, goals: ['control'] })

  // Hidden by reports: publishing again changes nothing.
  await admin.from('public_setups').update({ hidden: true }).eq('id', after.data![0].id)
  await author.keyboard.press('Escape')
  await author.getByRole('button', { name: 'Partilhar' }).first().click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await author.getByRole('dialog').getByRole('button', { name: 'Atualizar na comunidade' }).click()
  await expect(author.getByText('Este setup foi escondido depois de denúncias', { exact: false })).toBeVisible()
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
  await expect(page.getByRole('region', { name: 'Conta' }).getByRole('button', { name: 'Criar conta' })).toBeVisible()
  const left = await admin.from('measurements').select('id').eq('racket_id', rid).eq('weight_g', 323)
  expect(left.data).toEqual([])
})
