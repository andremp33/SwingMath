import { Check, Lock, Sparkles } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { isPro, useStore } from '../data/store'
import { useT } from '../i18n'
import { activateLicense, CHECKOUT_URL, LicenseError, storeConfigured } from '../lib/entitlement'
import { Badge, Button, Card, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'

const PaywallCtx = createContext<(reason?: string) => void>(() => {})

/** Opens the Pro sheet. Pass a reason to say why it appeared. */
export const usePaywall = () => useContext(PaywallCtx)

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>()
  const show = useCallback((r?: string) => {
    setReason(r)
    setOpen(true)
  }, [])
  const t = useT()
  return (
    <PaywallCtx.Provider value={show}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.pro.title}>
        {reason && <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-sm">{reason}</p>}
        <ProPanel onDone={() => setOpen(false)} />
      </Sheet>
    </PaywallCtx.Provider>
  )
}

export function ProPanel({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const toast = useToast()
  const license = useStore((s) => s.license)
  const setLicense = useStore((s) => s.setLicense)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [showKey, setShowKey] = useState(false)

  if (license) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="pro">Pro</Badge>
        <span className="text-sm">{t.pro.active}</span>
      </div>
    )
  }

  const activate = async () => {
    setBusy(true)
    setError(undefined)
    try {
      setLicense(await activateLicense(key))
      toast(t.pro.active)
      onDone?.()
    } catch (e) {
      const kind = e instanceof LicenseError ? e.kind : 'invalid'
      setError(kind === 'offline' ? t.pro.offline : kind === 'config' ? t.pro.notConfigured : t.pro.invalidKey)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t.pro.lead}</p>
      <ul className="space-y-2">
        {t.pro.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      {storeConfigured() ? (
        <a href={CHECKOUT_URL} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-on-accent">
          <Sparkles className="size-4" aria-hidden /> {t.pro.buy}
        </a>
      ) : (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{t.pro.notConfigured}</p>
      )}
      {!showKey ? (
        <Button variant="ghost" className="w-full" onClick={() => setShowKey(true)}>
          {t.pro.haveKey}
        </Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            activate()
          }}
        >
          <TextField label={t.pro.key} value={key} onChange={setKey} error={error} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" autoFocus />
          <Button type="submit" variant="secondary" className="w-full" loading={busy} disabled={key.trim().length < 8}>
            {busy ? t.pro.activating : t.pro.activate}
          </Button>
        </form>
      )}
      {import.meta.env.DEV && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            setLicense({ provider: 'dev', activatedAt: Date.now() })
            onDone?.()
          }}
        >
          {t.pro.devUnlock}
        </Button>
      )}
    </div>
  )
}

/** Shows children for Pro users; otherwise a card that opens the paywall. */
export function ProGate({ children, title }: { children: ReactNode; title: string }) {
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const t = useT()
  if (pro) return <>{children}</>
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <Lock className="size-7 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{t.pro.locked}</p>
      </div>
      <Button variant="primary" icon={Sparkles} onClick={() => paywall()}>
        {t.pro.unlock}
      </Button>
    </Card>
  )
}
