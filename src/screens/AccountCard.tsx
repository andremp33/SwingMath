import { LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { AccountError, deleteAccount, sendCode, signOut, syncNow, verifyCode } from '../app/account'
import { accountProActive, useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import { PRO_BETA } from '../lib/entitlement'
import { fmtDate } from '../lib/format'
import { Button, SettingsGroup, SettingsRow, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { usePaywall } from './Pro'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ago(ms: number, t: Dict) {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return t.account.justNow
  if (min < 60) return fmt(t.account.minutesAgo, { n: min })
  return fmt(t.account.hoursAgo, { n: Math.round(min / 60) })
}

/** The profile's top: the account and sync, or no account (data on this
 *  phone) with a way to create one. `entry` keeps the form closed until asked. */
export function AccountGroup({ entry }: { entry?: boolean }) {
  const t = useT()
  const account = useStore((s) => s.account)
  const [open, setOpen] = useState(!entry)
  if (!cloudConfigured()) return entry ? <p className="text-sm text-muted">{t.profile.noAccount}</p> : null
  return (
    <SettingsGroup title={t.account.title} action={!account && <span className="text-sm text-muted">{t.account.optional}</span>}>
      {account ? (
        <SignedIn />
      ) : open ? (
        <SignInForm />
      ) : (
        <SettingsRow label={t.profile.noAccount}>
          <Button variant="primary" size="sm" icon={UserRound} onClick={() => setOpen(true)}>
            {t.profile.createAccount}
          </Button>
        </SettingsRow>
      )}
    </SettingsGroup>
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
        className="space-y-3 py-3.5"
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <TextField label={t.account.email} value={email} onChange={setEmail} error={error} placeholder="nome@exemplo.com" maxLength={120} />
          <Button type="submit" variant="primary" icon={UserRound} loading={busy} disabled={!email.trim()} className="h-11">
            {t.account.sendCode}
          </Button>
        </div>
      </form>
    )
  }
  return (
    <form
      className="space-y-3 py-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          await verifyCode(email, code)
          toast(t.account.signedIn)
        })
      }}
    >
      <p className="text-sm">{fmt(t.account.codeSent, { email: email.trim() })}</p>
      <TextField label={t.account.code} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))} error={error} placeholder="123456" maxLength={10} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={code.length < 6}>
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
  const lang = useStore((s) => s.lang)
  const account = useStore((s) => s.account)!
  const accountPro = useStore((s) => s.accountPro)
  const sync = useStore((s) => s.sync)
  const paywall = usePaywall()
  const [busy, setBusy] = useState(false)
  // During the beta every account has Pro, sync included.
  const pro = PRO_BETA || accountProActive(accountPro)

  return (
    <>
      <SettingsRow
        label={fmt(t.account.signedInAs, { email: account.email })}
        hint={
          PRO_BETA
            ? t.account.betaPro
            : pro
            ? accountPro?.status === 'cancelled' && accountPro.endsAt
              ? fmt(t.account.proUntil, { date: fmtDate(Date.parse(accountPro.endsAt), lang) })
              : t.account.proActive
            : t.account.noPro
        }
      />
      <SettingsRow
        label={t.account.sync}
        hint={
          !pro
            ? t.account.syncPro
            : sync.error === 'nopro'
              ? t.account.syncNoPro
              : sync.error === 'offline'
                ? t.account.syncOffline
                : sync.error
                  ? t.account.syncOther
                  : sync.lastAt
                    ? fmt(t.account.syncedAt, { when: ago(sync.lastAt, t) })
                    : t.account.never
        }
      >
        {pro ? (
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await syncNow()
              setBusy(false)
            }}
          >
            {t.account.syncNow}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => paywall('sync', { asked: true })}>
            {t.settings.seePlans}
          </Button>
        )}
      </SettingsRow>
    </>
  )
}

/** At the end of the profile: sign out, or delete the account and what is in the cloud. */
export function AccountEnd() {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <SettingsGroup title={t.profile.account}>
      <SettingsRow label={t.account.signOut}>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={() => void signOut()}>
          {t.account.signOut}
        </Button>
      </SettingsRow>
      <SettingsRow label={t.account.deleteAccount} hint={t.account.deleteHint} danger>
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirm(true)}>
          {t.account.deleteAccount}
        </Button>
      </SettingsRow>

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
    </SettingsGroup>
  )
}
