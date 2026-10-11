// Finds anything wider than the screen on phones: node scripts/overflow-check.mjs [port]
import { chromium, devices } from '@playwright/test'
const port = process.argv[2] ?? '5175'
const base = `http://localhost:${port}`
const b = await chromium.launch()
const paths = ['/', '/rackets', '/rackets/new', '/setups', '/diario', '/match', '/cordas', '/medir', '/settings', '/sobre', '/privacidade']
let bad = 0
for (const w of [360, 390]) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: w, height: 800 } })
  const p = await ctx.newPage()
  await p.addInitScript(() => { if (!localStorage.getItem('swingmath')) localStorage.setItem('swingmath', JSON.stringify({ version: 3, state: { lang: 'pt' } })) })
  for (const path of paths) {
    await p.goto(base + path)
    await p.waitForTimeout(800)
    if (path === '/match') {
      for (const mode of ['Igualar raquetes']) { await p.getByRole('radio', { name: mode }).click(); await p.waitForTimeout(300) }
    }
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const over = []
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect()
        if (b.width && (b.right > vw + 0.5 || b.left < -0.5) && getComputedStyle(el).position !== 'fixed' && !el.closest('.sr-only')) {
          // Report the outermost offender only.
          if (!over.some((o) => o.el.contains(el))) over.push({ el, d: `${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? '').toString().slice(0, 60)} "${(el.textContent ?? '').trim().slice(0, 40)}" right=${Math.round(b.right)}` })
        }
      }
      return { sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 6).map((o) => o.d) }
    })
    // overflow-x: clip hides the scrollbar, so judge by what sticks out.
    if (r.over.length) {
      bad++
      console.log(`${w}px ${path}: scrollWidth ${r.sw} > ${r.vw}`)
      for (const o of r.over) console.log('   ', o)
    }
  }
  await ctx.close()
}
console.log(bad ? `${bad} pages overflow` : 'no horizontal overflow')
await b.close()
