// Source images for `npx capacitor-assets generate`, and the web app's PNG
// icons, drawn from the brand mark. Run: node scripts/app-assets.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

// The S, from the one source of the mark (viewBox 151 146 722 722).
const S = readFileSync('assets/brand/swingmath-mark-current.svg', 'utf8').match(/<path d="([^"]+)"/)[1]
const CLAY = '#B4532E'
const INK = '#1C1A17'
const PAPER = '#F5F3EE'

/** The mark in `ink`, its box `px` wide. */
const mark = (ink, px) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="151 146 722 722" width="${px}" height="${px}">
  <path d="${S}" fill="${ink}"/>
  <circle cx="707" cy="335" r="66.5" fill="${CLAY}"/><circle cx="318" cy="681" r="66.5" fill="${CLAY}"/>
</svg>`
const page = (bg, body, size) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">${body}</body></html>`
const jobs = [
  // Full icon (iOS, legacy Android): dark square, the mark at 62% of it.
  ['assets/icon-only.png', 1024, page(INK, mark(PAPER, Math.round(1024 * 0.62)), 1024)],
  // Adaptive icon: the mark at 58%, so even its farthest point (about half
  // its box from the centre) stays inside the 66% safe zone of any mask.
  ['assets/icon-foreground.png', 1024, page('transparent', mark(PAPER, Math.round(1024 * 0.58)), 1024)],
  ['assets/icon-background.png', 1024, page(INK, '', 1024)],
  ['assets/splash.png', 2732, page(PAPER, mark(INK, 560), 2732)],
  ['assets/splash-dark.png', 2732, page('#141312', mark(PAPER, 560), 2732)],
]
// The web app's icons: the square dark icon, as the browser and iOS crop it themselves.
const icon = readFileSync('public/icon.svg', 'utf8')
for (const [file, size] of [['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/apple-touch-icon.png', 180]])
  jobs.push([file, size, page(INK, icon.replace('<svg ', `<svg width="${size}" height="${size}" `), size)])

const b = await chromium.launch()
for (const [file, size, html] of jobs) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  await p.setContent(html)
  await p.screenshot({ path: file, omitBackground: file.endsWith('icon-foreground.png') })
  await p.close()
  console.log(file)
}
await b.close()
