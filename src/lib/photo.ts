import { IS_NATIVE } from './platform'

/**
 * The profile photo: picked from the gallery or taken with the camera
 * (Capacitor on a phone, a file input on the web), cut to the middle square
 * and made small before it is kept, so it fits on the device and the account.
 */
export const PHOTO_PX = 256
/** A picked file larger than this is refused before it is read. */
export const PHOTO_MAX_MB = 20
const MAX_PIXELS = 50e6

export class PhotoError extends Error {
  kind: 'tooBig' | 'unreadable' | 'denied'
  constructor(kind: PhotoError['kind']) {
    super(kind)
    this.kind = kind
  }
}

/** The middle square of an image, PHOTO_PX wide, as a JPEG data URL. */
export async function squarePhoto(file: Blob): Promise<string> {
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) throw new PhotoError('tooBig')
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('unreadable')
  // Turned upright by its EXIF orientation, as browsers show it.
  const img = await createImageBitmap(file).catch(() => {
    throw new PhotoError('unreadable')
  })
  try {
    const { width: w, height: h } = img
    if (!w || !h) throw new PhotoError('unreadable')
    if (w * h > MAX_PIXELS) throw new PhotoError('tooBig')
    const side = Math.min(w, h)
    let src: CanvasImageSource = img
    let sx = (w - side) / 2
    let sy = (h - side) / 2
    let size = side
    // Halved a step at a time: one big step down turns fine detail to noise.
    while (size / 2 >= PHOTO_PX * 1.5) {
      const half = canvas(Math.round(size / 2))
      half.ctx.drawImage(src, sx, sy, size, size, 0, 0, half.el.width, half.el.width)
      src = half.el
      sx = sy = 0
      size = half.el.width
    }
    const out = canvas(Math.min(PHOTO_PX, side))
    out.ctx.drawImage(src, sx, sy, size, size, 0, 0, out.el.width, out.el.width)
    return out.el.toDataURL('image/jpeg', 0.85)
  } finally {
    img.close()
  }
}

function canvas(px: number) {
  const el = document.createElement('canvas')
  el.width = el.height = px
  const ctx = el.getContext('2d')
  if (!ctx) throw new PhotoError('unreadable')
  ctx.imageSmoothingQuality = 'high'
  return { el, ctx }
}

/** In the store apps on a phone, not the app's build in a browser (tests,
 *  development): the camera plugin is there. */
export const hasCamera = () => IS_NATIVE && !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

/** The phone's camera or gallery (store apps); null when the player cancels. */
export async function nativePhoto(from: 'camera' | 'gallery'): Promise<string | null> {
  if (!hasCamera()) return null
  const { Camera, MediaTypeSelection } = await import('@capacitor/camera')
  try {
    const opts = { quality: 90, correctOrientation: true }
    const r = from === 'camera' ? await Camera.takePhoto(opts) : (await Camera.chooseFromGallery({ ...opts, mediaType: MediaTypeSelection.Photo })).results[0]
    if (!r?.webPath) return null
    return await squarePhoto(await (await fetch(r.webPath)).blob())
  } catch (e) {
    if (e instanceof PhotoError) throw e
    const { code, message } = (e ?? {}) as { code?: string; message?: string }
    // OS-PLUG-CAMR-0003 / -0005: the camera or the photos were refused.
    if (code === 'OS-PLUG-CAMR-0003' || code === 'OS-PLUG-CAMR-0005' || /denied|permission/i.test(message ?? '')) throw new PhotoError('denied')
    if (/cancel/i.test(`${code} ${message}`) || code === 'OS-PLUG-CAMR-0006') return null
    throw new PhotoError('unreadable')
  }
}

/** A data URL's bytes, to send (decoded here: the site's CSP keeps fetch off data:). */
export function photoBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',')
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: /^data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg' })
}

/** Bytes back to a data URL, to keep. */
export function photoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
