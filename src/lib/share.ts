import QRCode from 'qrcode'
import { z } from 'zod'
import { racketSchema, setupSchema } from '../data/db'
import type { Feel } from '../domain/feel'
import type { Racket, Setup, Specs } from '../domain/types'
import { fmtNum } from './format'

/** What travels in a share link: the setup and the frame it is built on. */
const payloadSchema = z.object({
  v: z.literal(1),
  setup: setupSchema.omit({ id: true, createdAt: true, updatedAt: true, favourite: true }),
  racket: racketSchema.omit({ createdAt: true, updatedAt: true }),
})
export type SharePayload = z.infer<typeof payloadSchema>

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeShare(setup: Setup, racket: Racket): string {
  const { id: _id, createdAt: _c, updatedAt: _u, favourite: _f, ...s } = setup
  const { createdAt: _rc, updatedAt: _ru, ...r } = racket
  return toB64Url(JSON.stringify({ v: 1, setup: s, racket: r }))
}

export function decodeShare(data: string): SharePayload | null {
  try {
    const r = payloadSchema.safeParse(JSON.parse(fromB64Url(data)))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

export const shareUrl = (data: string) => `${location.origin}${import.meta.env.BASE_URL}s/${data}`

/** Feel colours in FEEL_KEYS order, dark-theme steps (the card is dark). */
const FEEL_COLORS = ['#d95926', '#3987e5', '#199e70', '#9085e9', '#d55181', '#c98500']

export interface ImageText {
  title: string
  racket: string
  rows: [string, string][]
  feel: [string, number][]
  lead: string
  accessories: string
  scan: string
  appName: string
  domain: string
}

/** Draws a 1080x1350 card (portrait, fits stories and feeds). */
export async function renderShareImage(text: ImageText, url: string): Promise<Blob> {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  await document.fonts?.ready
  const font = (w: number, px: number) => `${w} ${px}px "Instrument Sans Variable", system-ui, sans-serif`
  // Same colours as the dark theme.
  const BG = '#141312'
  const TEXT = '#ece9e3'
  const MUTED = '#a39e94'
  const LINE = '#2f2d2a'
  const CLAY = '#d9764a'

  g.fillStyle = BG
  g.fillRect(0, 0, W, H)

  g.fillStyle = MUTED
  g.font = font(500, 30)
  g.fillText(text.racket, 72, 116)
  g.fillStyle = TEXT
  g.font = font(600, 64)
  g.fillText(text.title, 72, 194, W - 144)

  // Spec rows.
  let y = 290
  for (const [k, v] of text.rows) {
    g.fillStyle = MUTED
    g.font = font(400, 30)
    g.fillText(k, 72, y)
    g.fillStyle = TEXT
    g.font = font(560, 38)
    const w = g.measureText(v).width
    g.fillText(v, W - 72 - w, y)
    g.fillStyle = LINE
    g.fillRect(72, y + 24, W - 144, 2)
    y += 70
  }

  // Feel rings, three per row.
  const R = 56
  text.feel.forEach(([k, v], i) => {
    const cx = 72 + 156 + (i % 3) * 312
    const cy = 734 + Math.floor(i / 3) * 172
    g.lineWidth = 12
    g.lineCap = 'round'
    g.strokeStyle = LINE
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = FEEL_COLORS[i] ?? CLAY
    g.beginPath()
    g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v) / 100)
    g.stroke()
    g.fillStyle = TEXT
    g.font = font(560, 40)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(v), cx, cy + 2)
    g.fillStyle = MUTED
    g.font = font(400, 24)
    g.fillText(k, cx, cy + R + 30)
    g.textAlign = 'start'
    g.textBaseline = 'alphabetic'
  })

  g.fillStyle = MUTED
  g.font = font(400, 26)
  // Below the rings, left of the QR code.
  wrap(g, text.lead, 72, 1068, 620, 34)
  wrap(g, text.accessories, 72, 1148, 620, 34)

  // QR in the corner.
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { width: 210, margin: 1, color: { dark: BG, light: '#ffffff' } })
  g.fillStyle = '#ffffff'
  roundRect(g, W - 72 - 226, H - 72 - 262, 226, 226, 12)
  g.drawImage(qr, W - 72 - 218, H - 72 - 254, 210, 210)
  g.fillStyle = MUTED
  g.font = font(400, 22)
  const sw = g.measureText(text.scan).width
  g.fillText(text.scan, W - 72 - 113 - sw / 2, H - 72)

  g.fillStyle = TEXT
  g.font = font(600, 40)
  g.fillText(text.appName, 72, H - 110)
  g.fillStyle = MUTED
  g.font = font(400, 26)
  g.fillText(text.domain, 72, H - 70)

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'))
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0) return
  g.beginPath()
  g.roundRect(x, y, w, h, Math.min(r, w / 2))
  g.fill()
}

function wrap(g: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lh: number) {
  let line = ''
  for (const word of s.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y)
      line = word
      y += lh
    } else line = test
  }
  if (line) g.fillText(line, x, y)
}

export function specRowsText(s: Specs, lang: string, labels: { w: string; b: string; sw: string; tw: string; rw: string; pts: string }): [string, string][] {
  return [
    [labels.w, `${fmtNum(s.weightG, 1, lang)} g`],
    [labels.b, `${fmtNum(s.balanceCm * 10, 1, lang)} mm · ${fmtNum(s.ptsHL, 1, lang)} ${labels.pts}`],
    [labels.sw, fmtNum(s.swingweight, 1, lang)],
    [labels.tw, fmtNum(s.twistweight, 2, lang)],
    [labels.rw, fmtNum(s.recoilWeight, 1, lang)],
  ]
}

export type { Feel }
