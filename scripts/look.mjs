// Visual review: node scripts/look.mjs <theme> <width> <path> [scrollY] -> replica/review/look-*.png
import { chromium } from '@playwright/test'
const [theme = 'dark', width = '390', path = '/', scroll = '0'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: Number(width), height: Number(width) > 800 ? 900 : 844 }, colorScheme: theme })
await p.addInitScript((th) => {
  localStorage.setItem('swingmath', JSON.stringify({ version: 2, state: { lang: 'pt', theme: th, tapeGPer10cm: 4, license: { provider: 'dev', activatedAt: 1 }, config: { racketId: 'stock-babolat-pure-aero-98-2026', baseMode: 'reference', measured: {}, accessories: { strings: true, leatherGrip: false, overgrip: true, dampener: false }, leadG: { tip: 2, tenTwo: 0, threeNine: 2, throat: 0, handle: 0 }, extra: [{ id: 'a', kind: 'hoop', hour: 11, sides: 2, grams: 1.5 }] } } }))
}, theme)
await p.goto('http://localhost:5173' + path)
await p.waitForTimeout(700)
if (Number(scroll)) await p.evaluate((y) => window.scrollTo(0, y), Number(scroll))
await p.waitForTimeout(200)
const out = `replica/review/look-${theme}-${width}${path.replace(/\W+/g, '-')}${scroll !== '0' ? '-' + scroll : ''}.png`
await p.screenshot({ path: out })
console.log(out)
await b.close()
