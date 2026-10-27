/** The colour of the app's top bar, painted as the player's court
 *  (.court-band in index.css): the court's paint, a little darker at night.
 *  The status bar takes it, so the court runs to the top of the screen. */
export function courtBarColor(): string | null {
  const root = document.documentElement
  const base = getComputedStyle(root).getPropertyValue('--court-base').trim()
  const m = /^#([0-9a-f]{6})$/i.exec(base)
  if (!m) return null
  if (root.dataset.theme === 'light') return base
  // As --court-shade does: 22% black over the paint.
  const n = parseInt(m[1], 16)
  const dim = (c: number) => Math.round(c * 0.78).toString(16).padStart(2, '0')
  return `#${dim(n >> 16)}${dim((n >> 8) & 255)}${dim(n & 255)}`
}
