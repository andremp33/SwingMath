// Source images for `npx capacitor-assets generate`: icon and splash, drawn
// from the logo. Run: node scripts/app-assets.mjs
import { chromium } from '@playwright/test'
const mark = (ink, size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${32 + 2 * pad} ${32 + 2 * pad}" width="${size}" height="${size}">
  <path d="M8 25A17 17 0 0 1 25 8" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="8" cy="25" r="2" fill="${ink}"/><circle cx="13" cy="13" r="3.4" fill="#d9764a"/>
</svg>`
const page = (bg, body, size) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">${body}</body></html>`
const jobs = [
  // Full icon (iOS, legacy Android): dark tile, mark with some margin.
  ['icon-only.png', 1024, page('#1c1a17', mark('#ece9e3', 1024, 4), 1024)],
  // Adaptive icon: the foreground sits inside the 66% safe zone.
  ['icon-foreground.png', 1024, page('transparent', mark('#ece9e3', 1024, 14), 1024)],
  ['icon-background.png', 1024, page('#1c1a17', '', 1024)],
  ['splash.png', 2732, page('#f5f3ee', mark('#1c1a17', 520, 2), 2732)],
  ['splash-dark.png', 2732, page('#141312', mark('#ece9e3', 520, 2), 2732)],
]
const b = await chromium.launch()
for (const [file, size, html] of jobs) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  await p.setContent(html)
  await p.screenshot({ path: `assets/${file}`, omitBackground: file === 'icon-foreground.png' })
  await p.close()
  console.log(file)
}
await b.close()
