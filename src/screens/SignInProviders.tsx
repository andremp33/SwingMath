import { Loader2 } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AccountError, signInWithIdToken, signInWithProvider } from '../app/account'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { LOCALE } from '../lib/format'
import { platform, prepareAppleWeb, providers, renderGoogleButton, type IdToken, type Provider } from '../lib/socialSignIn'
import { cx } from '../ui/basics'
import { useToast } from '../ui/overlay'

/** The page's theme as painted (the attribute, not the setting: "system"
 *  resolves there). */
function useDark() {
  const read = () => document.documentElement.dataset.theme !== 'light'
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const o = new MutationObserver(() => setDark(read()))
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => o.disconnect()
  }, [])
  return dark
}

/** Apple and Google, above the email (and the line that leads to it): their
 *  own sheets in the store apps; in a browser, Apple's popup and Google's own
 *  button. Nothing when this build has neither. */
export function SignInProviders({ onSignedIn }: { onSignedIn: (fresh: boolean, name?: string) => void }) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState<Provider>()
  const [error, setError] = useState<string>()
  // Google's button again after a failed try: a new one has a new nonce.
  const [tries, setTries] = useState(0)
  const shown = providers()
  const web = platform() === 'web'
  useEffect(() => {
    if (web && shown.apple) prepareAppleWeb()
  }, [web, shown.apple])
  if (!shown.apple && !shown.google) return null

  const run = async (provider: Provider, fn: () => Promise<{ fresh: boolean; name?: string } | null>) => {
    setBusy(provider)
    setError(undefined)
    try {
      const r = await fn()
      if (!r) return
      toast(t.account.signedIn)
      onSignedIn(r.fresh, r.name)
    } catch (e) {
      setError(t.account.errors[e instanceof AccountError ? e.kind : 'provider'])
      if (provider === 'google') setTries((n) => n + 1)
    } finally {
      setBusy(undefined)
    }
  }
  // Same height side by side: Google's own button is 40 px in a browser.
  const tall = !web
  return (
    <div className="w-full max-w-[400px] space-y-2">
      {shown.apple && <AppleButton tall={tall} busy={busy === 'apple'} disabled={!!busy} onClick={() => void run('apple', () => signInWithProvider('apple'))} />}
      {shown.google &&
        (web ? (
          <GoogleWebButton key={tries} onToken={(tok) => void run('google', () => signInWithIdToken(tok))} />
        ) : (
          <GoogleButton busy={busy === 'google'} disabled={!!busy} onClick={() => void run('google', () => signInWithProvider('google'))} />
        ))}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="flex items-center gap-3 pt-2 text-sm text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden />
        {t.account.orEmail}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </p>
    </div>
  )
}

interface ButtonProps {
  busy: boolean
  disabled: boolean
  onClick: () => void
}

/** Apple's Human Interface Guidelines: black on a light page, white on a
 *  dark one, the logo then the title in the system font, at the size of
 *  Apple's own button of that height. */
function AppleButton({ tall, busy, disabled, onClick }: ButtonProps & { tall: boolean }) {
  const t = useT()
  const dark = useDark()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cx(
        'press flex w-full items-center justify-center gap-1.5 font-medium select-none disabled:opacity-60',
        tall ? 'h-11 rounded-md text-[17px]' : 'h-10 rounded text-base',
        dark ? 'bg-white text-black' : 'bg-black text-white',
      )}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif', letterSpacing: '-0.01em' }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <AppleLogo />}
      {t.account.continueApple}
    </button>
  )
}

/** Google's branding guidelines: white with a grey line on a light page,
 *  #131314 on a dark one, the colour G, Roboto Medium 14 px. */
function GoogleButton({ busy, disabled, onClick }: ButtonProps) {
  const t = useT()
  const dark = useDark()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cx(
        'press flex h-11 w-full items-center justify-center gap-2.5 rounded-md border text-sm font-medium select-none disabled:opacity-60',
        dark ? 'border-[#8e918f] bg-[#131314] text-[#e3e3e3]' : 'border-[#747775] bg-white text-[#1f1f1f]',
      )}
      style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
    >
      {busy ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <GoogleLogo />}
      {t.account.continueGoogle}
    </button>
  )
}

/** A browser: Google draws its own button (an iframe), in its light or dark
 *  theme. Offline, its script does not load and there is no button. */
function GoogleWebButton({ onToken }: { onToken: (t: IdToken) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dark = useDark()
  const lang = useStore((s) => s.lang)
  const [failed, setFailed] = useState(false)
  const token = useEffectEvent(onToken)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    renderGoogleButton(el, { dark, locale: LOCALE[lang] ?? 'en', width: el.offsetWidth }, (t) => live && token(t)).catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [dark, lang])
  if (failed) return null
  // The iframe keeps a light scheme, or a dark page would paint a box round it.
  return <div ref={ref} className="flex h-10 w-full justify-center overflow-hidden [color-scheme:light]" />
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 17 20" className="-mt-0.5 h-[1.05em] w-auto" fill="currentColor" aria-hidden>
      <path d="M14.04 10.62c-.02-2.17 1.78-3.22 1.86-3.27-1.01-1.48-2.59-1.69-3.15-1.71-1.34-.14-2.62.79-3.3.79-.68 0-1.73-.77-2.84-.75-1.46.02-2.81.85-3.56 2.16-1.52 2.63-.39 6.53 1.09 8.67.72 1.05 1.58 2.22 2.71 2.18 1.09-.04 1.5-.7 2.81-.7 1.31 0 1.68.7 2.83.68 1.17-.02 1.91-1.07 2.62-2.12.83-1.21 1.17-2.39 1.19-2.45-.03-.01-2.28-.87-2.3-3.47ZM11.88 4.24c.6-.73 1-1.73.89-2.74-.86.04-1.9.57-2.52 1.3-.55.64-1.04 1.67-.91 2.65.96.07 1.94-.49 2.54-1.21Z" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
