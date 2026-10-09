import { LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { AccountError, deleteAccount, sendCode, signOut, syncNow, verifyCode } from '../app/account'
import { accountProActive, useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import { fmtDate } from '../lib/format'
import { Badge, Button, Card, CardTitle, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ago(ms: number, t: Dict) {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return t.account.justNow
  if (min < 60) return fmt(t.account.minutesAgo, { n: min })
  return fmt(t.account.hoursAgo, { n: Math.round(min / 60) })
}

/** Settings card: sign in with a code, or the account's status. */
export function AccountCard() {
  const t = useT()
  const account = useStore((s) => s.account)
  if (!cloudConfigured()) return null
  return (
    <Card label={t.account.title}>
      <CardTitle action={!account && <span className="text-sm text-muted">{t.account.optional}</span>}>{t.account.title}</CardTitle>
      {account ? <SignedIn /> : <SignInForm />}
    </Card>
  )
}

function SignInForm() {
  const t = useT()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(t.account.errors[e instanceof AccountError ? e.kind : 'invalid'])
    } finally {
      setBusy(false)
    }
  }
  const send = () =>
    run(async () => {
      await sendCode(email)
      setSent(true)
    })

  if (!sent) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!EMAIL.test(email.trim())) {
            setError(t.account.errors.email)
            return
          }
          void send()
        }}
      >
        <p className="text-sm text-muted">{t.account.intro}</p>
        <TextField label={t.account.email} value={email} onChange={setEmail} error={error} placeholder="nome@exemplo.com" maxLength={120} />
        <Button type="submit" variant="primary" icon={UserRound} loading={busy} disabled={!email.trim()}>
          {t.account.sendCode}
        </Button>
      </form>
    )
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          await verifyCode(email, code)
          toast(t.account.signedIn)
        })
      }}
    >
      <p className="text-sm">{fmt(t.account.codeSent, { email: email.trim() })}</p>
      <TextField label={t.account.code} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} error={error} placeholder="123456" maxLength={6} autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>
          {t.account.signIn}
        </Button>
        <Button variant="ghost" onClick={() => void run(() => sendCode(email))}>
          {t.account.resend}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSent(false)
            setCode('')
            setError(undefined)
          }}
        >
          {t.account.otherEmail}
        </Button>
      </div>
    </form>
  )
}

function SignedIn() {
  const t = useT()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const account = useStore((s) => s.account)!
  const accountPro = useStore((s) => s.accountPro)
  const sync = useStore((s) => s.sync)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const pro = accountProActive(accountPro)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm">{fmt(t.account.signedInAs, { email: account.email })}</p>
        {pro && <Badge tone="pro">Pro</Badge>}
      </div>
      <p className="text-sm text-muted">
        {pro
          ? accountPro?.status === 'cancelled' && accountPro.endsAt
            ? fmt(t.account.proUntil, { date: fmtDate(Date.parse(accountPro.endsAt), lang) })
            : t.account.proActive
          : t.account.noPro}
      </p>

      <div className="border-t border-border pt-3">
        <p className="text-sm font-medium">{t.account.sync}</p>
        <p className="text-sm text-muted">
          {!pro
            ? t.account.syncPro
            : sync.error === 'nopro'
              ? t.account.syncNoPro
              : sync.error === 'offline'
                ? t.account.syncOffline
                : sync.error
                  ? t.account.syncOther
                  : sync.lastAt
                    ? fmt(t.account.syncedAt, { when: ago(sync.lastAt, t) })
                    : t.account.never}
        </p>
        {pro && (
          <Button
            size="sm"
            icon={RefreshCw}
            className="mt-2"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await syncNow()
              setBusy(false)
            }}
          >
            {t.account.syncNow}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" icon={LogOut} onClick={() => void signOut()}>
          {t.account.signOut}
        </Button>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirm(true)}>
          {t.account.deleteAccount}
        </Button>
      </div>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.account.deleteAccount}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await deleteAccount()
                  toast(t.account.deleted)
                  setConfirm(false)
                } catch (e) {
                  toast(t.account.errors[e instanceof AccountError ? e.kind : 'offline'])
                } finally {
                  setBusy(false)
                }
              }}
            >
              {t.account.deleteConfirm}
            </Button>
          </>
        }
      >
        <p className="text-sm">{t.account.deleteBody}</p>
      </Sheet>
    </div>
  )
}
