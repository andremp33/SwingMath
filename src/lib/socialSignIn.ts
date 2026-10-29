import { IS_NATIVE } from './platform'

/**
 * Sign in with Apple and Google. Their own sheets give an ID token, which
 * Supabase checks (signInWithIdToken): no page of ours or Supabase's shows.
 * The store apps use the native sheets (@capgo/capacitor-social-login); a
 * browser, Google's own button and Apple's popup (Sign in with Apple JS).
 * Each sign-in carries a nonce: its hash goes to Apple or Google, who put it
 * in the token, and the nonce itself to Supabase, which compares the two.
 */
export type Provider = 'apple' | 'google'

/** What Apple or Google gave: the token, its nonce, and the name they shared
 *  (Apple: only on the first sign-in). */
export interface IdToken {
  provider: Provider
  token: string
  nonce: string
  name?: string
}

const env = (v: string | undefined) => v?.trim() || undefined
const GOOGLE_WEB = env(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID)
const GOOGLE_IOS = env(import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID)
const APPLE_WEB = env(import.meta.env.VITE_APPLE_SERVICE_ID)

/** Where this runs: the store apps on iOS or Android, or a browser (the
 *  app's preview, or `dev:app`, where the plugins have no native side). */
export function platform(): 'ios' | 'android' | 'web' {
  const p = IS_NATIVE ? (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() : undefined
  return p === 'ios' || p === 'android' ? p : 'web'
}

/** The buttons this build shows. Apple on the iPhone always (App Store
 *  guideline 4.8: it comes with Google), in a browser with its Services ID;
 *  not on Android, where it would need a page of ours to come back to. */
export function providers(): Record<Provider, boolean> {
  const p = platform()
  return { apple: p === 'ios' || (p === 'web' && !!APPLE_WEB), google: !!GOOGLE_WEB && (p !== 'ios' || !!GOOGLE_IOS) }
}

const EMAIL_CODE = import.meta.env.VITE_EMAIL_SIGN_IN === 'true'

/** The code by email: only once the app sends email of its own (custom SMTP,
 *  then VITE_EMAIL_SIGN_IN=true), or when this build has neither Apple nor
 *  Google (development, the tests), so there is always a way in. */
export function emailSignIn() {
  const p = providers()
  return EMAIL_CODE || (!p.apple && !p.google)
}

/** Closed without choosing an account: not an error. */
export class Cancelled extends Error {}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/** A new nonce and its SHA-256 (hex), the form Apple and Google expect. */
export async function newNonce() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(16)))
  const hashed = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
  return { raw, hashed }
}

const fullName = (...parts: (string | null | undefined)[]) => parts.filter((p) => p?.trim()).join(' ').trim() || undefined

/** A claim of a JWT, read without checking it (Supabase checks the token). */
function claim(jwt: string, key: string): string | undefined {
  try {
    const body = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)))
    const v = (JSON.parse(json) as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

type SocialLogin = (typeof import('@capgo/capacitor-social-login'))['SocialLogin']
let plugin: Promise<SocialLogin> | null = null

const nativePlugin = () =>
  (plugin ??= import('@capgo/capacitor-social-login')
    .then(async ({ SocialLogin }) => {
      await SocialLogin.initialize({
        ...(GOOGLE_WEB && { google: { webClientId: GOOGLE_WEB, iOSClientId: GOOGLE_IOS, iOSServerClientId: GOOGLE_WEB, mode: 'online' as const } }),
        // On iOS the client ID only tells the plugin to set Apple up.
        ...(platform() === 'ios' && { apple: { clientId: 'app.swingmath' } }),
      })
      return SocialLogin
    })
    .catch((e: unknown) => {
      plugin = null
      throw e
    }))

/** The store apps: Apple's or Google's own sheet. */
export async function nativeIdToken(provider: Provider): Promise<IdToken> {
  const login = await nativePlugin()
  const { raw, hashed } = await newNonce()
  try {
    if (provider === 'apple') {
      const { result } = await login.login({ provider: 'apple', options: { scopes: ['email', 'name'], nonce: hashed } })
      if (!result.idToken) throw new Error('no token')
      return { provider, token: result.idToken, nonce: raw, name: fullName(result.profile.givenName, result.profile.familyName) }
    }
    const { result } = await login.login({ provider: 'google', options: { nonce: hashed } })
    if (result.responseType !== 'online' || !result.idToken) throw new Error('no token')
    return { provider, token: result.idToken, nonce: raw, name: fullName(result.profile.name) }
  } catch (e) {
    if ((e as { code?: string }).code === 'USER_CANCELLED') throw new Cancelled()
    throw e
  }
}

const scripts = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  let p = scripts.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scripts.delete(src)
        s.remove()
        reject(new Error(`failed to load ${src}`))
      }
      document.head.append(s)
    })
    scripts.set(src, p)
  }
  return p
}

interface GoogleId {
  initialize(o: Record<string, unknown> & { callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, o: Record<string, unknown>): void
}
interface AppleIdAuth {
  init(o: Record<string, unknown>): void
  signIn(): Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>
}
const gis = () => (globalThis as { google?: { accounts: { id: GoogleId } } }).google!.accounts.id
const appleJs = () => (globalThis as { AppleID?: { auth: AppleIdAuth } }).AppleID!.auth

/** A browser: Google's own button (Google Identity Services) in `el`. Each
 *  render has its own nonce; a sign-in that fails renders it again. */
export async function renderGoogleButton(el: HTMLElement, look: { dark: boolean; locale: string; width: number }, onToken: (t: IdToken) => void) {
  await loadScript('https://accounts.google.com/gsi/client')
  const { raw, hashed } = await newNonce()
  gis().initialize({
    client_id: GOOGLE_WEB,
    nonce: hashed,
    ux_mode: 'popup',
    auto_select: false,
    use_fedcm_for_button: true,
    callback: ({ credential }) => onToken({ provider: 'google', token: credential, nonce: raw, name: fullName(claim(credential, 'name')) }),
  })
  el.replaceChildren()
  gis().renderButton(el, { type: 'standard', theme: look.dark ? 'filled_black' : 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', logo_alignment: 'center', width: Math.round(Math.min(400, Math.max(200, look.width))), locale: look.locale })
}

const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
let appleNonce: Promise<{ raw: string; hashed: string }> | null = null

/** A browser: loads Apple's script and the next nonce before the tap, so the
 *  popup opens on the tap itself (or the browser would block it). */
export function prepareAppleWeb() {
  void loadScript(APPLE_JS).catch(() => {})
  appleNonce ??= newNonce()
}

/** A browser: Apple's popup. */
export async function appleWebIdToken(): Promise<IdToken> {
  const nonce = appleNonce ?? newNonce()
  appleNonce = null
  const [{ raw, hashed }] = await Promise.all([nonce, loadScript(APPLE_JS)])
  // The return URL is only checked against the Services ID: the popup hands
  // the answer back to this page.
  appleJs().init({ clientId: APPLE_WEB, scope: 'name email', redirectURI: `${location.origin}${import.meta.env.BASE_URL}`, usePopup: true, nonce: hashed })
  try {
    const r = await appleJs().signIn()
    return { provider: 'apple', token: r.authorization.id_token, nonce: raw, name: fullName(r.user?.name?.firstName, r.user?.name?.lastName) }
  } catch (e) {
    const code = (e as { error?: string }).error
    if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize') throw new Cancelled()
    throw e
  } finally {
    prepareAppleWeb()
  }
}
