// Loads the production build with the CSP from public/_headers and reports violations.
// Usage: npm run build && npx vite preview --port 4173, then node scripts/csp-check.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const csp = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.*)/)[1]
const b = await chromium.launch()
const ctx = await b.newContext()
await ctx.route('**/*', async (route) => {
  const r = await route.fetch()
  const headers = { ...r.headers() }
  if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = csp
  await route.fulfill({ response: r, headers })
})
const p = await ctx.newPage()
const problems = []
p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problems.push(m.text()) })
p.on('pageerror', (e) => problems.push(e.message))
for (const path of ['/', '/sobre', '/rackets', '/match', '/settings', '/privacidade']) {
  await p.goto('http://localhost:4173' + path)
  await p.waitForTimeout(800)
}
await p.goto('http://localhost:4173/')
await p.getByRole('button', { name: /Guardar setup|Save setup/ }).click()
await p.getByRole('dialog').getByRole('button', { name: /^(Guardar|Save)$/ }).click()
await p.waitForTimeout(500)
await p.goto('http://localhost:4173/setups')
await p.getByRole('button', { name: /Partilhar|Share/ }).first().click()
await p.waitForTimeout(1500)
console.log(problems.length ? problems.join('\n') : 'no CSP violations or errors')
await b.close()
