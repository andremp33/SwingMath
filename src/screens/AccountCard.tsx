import { AtSign, ExternalLink, ImageUp, LogOut, RefreshCw, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { AccountError, changeEmail, confirmEmailCode, deleteAccount, isReviewEmail, REVIEW_EMAIL, sendCode, signInWithPassword, signOut, syncHere, syncNow, verifyCode } from '../app/account'
import { accountProActive, useStore } from '../data/store'
import { fmt, useT, type Dict } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import { IS_APP } from '../lib/platform'
import { PRO_BETA } from '../lib/entitlement'
import { fmtDate } from '../lib/format'
import { emailSignIn } from '../lib/socialSignIn'
import { Button, SettingsGroup, SettingsRow, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { MeSheet } from './MeEditor'
import { usePaywall } from './Pro'
import { SignInProviders } from './SignInProviders'

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
  // A new account, on a device without a name or photo: ask for them (with
  // the name Apple or Google shared, if any, already written).
  const [welcome, setWelcome] = useState<{ name?: string }>()
  if (!cloudConfigured()) return entry ? <p className="text-sm text-muted">{t.profile.noAccount}</p> : null
  return (
    <SettingsGroup title={t.account.title} action={!account && <span className="text-sm text-muted">{t.account.optional}</span>}>
      {account ? (
        <SignedIn />
      ) : open ? (
        <SignInForm
          onSignedIn={(fresh, name) => {
            const { me } = useStore.getState()
            if (fresh && !me.name && !me.photo) setWelcome({ name })
          }}
        />
      ) : (
        <SettingsRow label={t.profile.noAccount}>
          <Button variant="primary" size="sm" icon={UserRound} onClick={() => setOpen(true)}>
            {t.profile.createAccount}
          </Button>
        </SettingsRow>
      )}
      {welcome && <MeSheet title={t.me.welcome} name={welcome.name} onClose={() => setWelcome(undefined)} />}
    </SettingsGroup>
  )
}

function SignInForm({ onSignedIn }: { onSignedIn: (fresh: boolean, name?: string) => void }) {
  const t = useT()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // Without the email code, the stores' reviewers' form waits behind a link.
  const [reviewOpen, setReviewOpen] = useState(false)

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

  // The stores' reviewers: a password, only for their one email (without
  // the email code, the form is only theirs).
  const byEmail = emailSignIn()
  const review = !byEmail || isReviewEmail(email)
  const form = byEmail || reviewOpen
  if (!sent) {
    return (
      <div className="space-y-3 py-3.5">
        <p className="text-sm text-muted">{t.account.intro}</p>
        <SignInProviders onSignedIn={onSignedIn} divider={form} />
        {!form && REVIEW_EMAIL && (
          <button type="button" className="press block py-1 text-sm text-muted underline-offset-2 hover:underline" onClick={() => setReviewOpen(true)}>
            {t.account.reviewAccount}
          </button>
        )}
        {form && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!EMAIL.test(email.trim())) {
                setError(t.account.errors.email)
                return
              }
              if (review)
                void run(async () => {
                  await signInWithPassword(email, password)
                  toast(t.account.signedIn)
                })
              else void send()
            }}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField label={t.account.email} value={email} onChange={setEmail} error={error} placeholder="nome@exemplo.com" maxLength={120} />
              {!review && (
                <Button type="submit" variant="primary" icon={UserRound} loading={busy} disabled={!email.trim()} className="h-11">
                  {t.account.sendCode}
                </Button>
              )}
            </div>
            {review && (
              <>
                <TextField label={t.account.password} hint={t.account.passwordHint} type="password" value={password} onChange={setPassword} maxLength={200} />
                <Button type="submit" variant="primary" loading={busy} disabled={!password}>
                  {t.account.signIn}
                </Button>
              </>
            )}
          </form>
        )}
      </div>
    )
  }
  return (
    <form
      className="space-y-3 py-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          const fresh = await verifyCode(email, code)
          toast(t.account.signedIn)
          onSignedIn(fresh)
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
  const me = useStore((s) => s.me)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<'email' | 'me'>()
  const paywall = usePaywall()
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
      >
        {/* The stores' review account keeps its one email; without email
            of our own, nobody's changes (it is confirmed by codes). */}
        {emailSignIn() && !isReviewEmail(account.email) && (
          <Button variant="secondary" size="sm" icon={AtSign} onClick={() => setSheet('email')}>
            {t.account.changeEmail}
          </Button>
        )}
      </SettingsRow>
      {!me.name && !me.photo && (
        <SettingsRow label={t.account.addMe} hint={t.account.addMeHint}>
          <Button variant="secondary" size="sm" icon={ImageUp} onClick={() => setSheet('me')}>
            {t.account.add}
          </Button>
        </SettingsRow>
      )}
      {/* Any account: it is the player's backup. Without Pro, on one device
          at a time; this one can take it back. */}
      <SettingsRow
        label={t.account.sync}
        hint={
          sync.error === 'offline'
            ? t.account.syncOffline
            : sync.error === 'elsewhere'
              ? t.account.syncElsewhere
              : sync.error
                ? t.account.syncOther
                : sync.lastAt
                  ? fmt(t.account.syncedAt, { when: ago(sync.lastAt, t) })
                  : t.account.never
        }
      >
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={busy}
          onClick={async () => {
            setBusy(true)
            await (sync.error === 'elsewhere' ? syncHere() : syncNow())
            setBusy(false)
          }}
        >
          {sync.error === 'elsewhere' ? t.account.syncHere : t.account.syncNow}
        </Button>
      </SettingsRow>
      {sync.error === 'elsewhere' && (
        <SettingsRow label={t.paywall.titles.sync} hint={t.paywall.subs.sync}>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => paywall('sync', { asked: true })}>
            {t.paywall.seePro}
          </Button>
        </SettingsRow>
      )}
      {sheet === 'email' && <EmailSheet onClose={() => setSheet(undefined)} />}
      {sheet === 'me' && <MeSheet onClose={() => setSheet(undefined)} />}
    </>
  )
}

/** A new email for the account: asked, then confirmed with the code sent to
 *  it and, with secure email change, the one sent to the current email. */
function EmailSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  // As it was when asked: the account's changes once a code completes it.
  const [current] = useState(() => useStore.getState().account!.email)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [codeNew, setCodeNew] = useState('')
  const [codeOld, setCodeOld] = useState('')
  // The current email's code, once accepted, is not asked again.
  const [oldDone, setOldDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 10)

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
  const send = () => {
    const next = email.trim()
    if (!EMAIL.test(next)) return setError(t.account.errors.email)
    if (next.toLowerCase() === current.toLowerCase()) return setError(t.account.sameEmail)
    void run(async () => {
      await changeEmail(next)
      setSent(true)
    })
  }
  const changed = () => {
    toast(fmt(t.account.emailChanged, { email: email.trim() }))
    onClose()
  }
  // Each code that the server accepts may complete the change: then no
  // other is asked for (it would be refused).
  const confirm = () =>
    run(async () => {
      if (codeOld && !oldDone) {
        if (await confirmEmailCode(current, codeOld, email)) return changed()
        setOldDone(true)
      }
      if (await confirmEmailCode(email, codeNew, email)) changed()
      else setError(fmt(t.account.missingOther, { email: current }))
    })

  return (
    <Sheet
      open
      onClose={onClose}
      title={t.account.changeEmailTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {sent ? (
            <Button variant="primary" loading={busy} disabled={codeNew.length < 6} onClick={() => void confirm()}>
              {t.account.confirmChange}
            </Button>
          ) : (
            <Button variant="primary" loading={busy} disabled={!email.trim()} onClick={send}>
              {t.account.sendCode}
            </Button>
          )}
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!sent) send()
          else if (codeNew.length >= 6) void confirm()
        }}
      >
        <p className="text-sm text-muted">{fmt(t.account.changeEmailIntro, { email: current })}</p>
        {!sent ? (
          <TextField label={t.account.newEmail} value={email} onChange={setEmail} error={error} placeholder="nome@exemplo.com" maxLength={120} autoFocus />
        ) : (
          <>
            <TextField label={fmt(t.account.codeNew, { email: email.trim() })} value={codeNew} onChange={(v) => setCodeNew(digits(v))} error={error} placeholder="123456" maxLength={10} />
            {!oldDone && <TextField label={fmt(t.account.codeCurrent, { email: current })} hint={t.account.codeCurrentHint} value={codeOld} onChange={(v) => setCodeOld(digits(v))} placeholder="123456" maxLength={10} />}
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => changeEmail(email))}>
              {t.account.resend}
            </Button>
          </>
        )}
      </form>
    </Sheet>
  )
}

/** At the end of the profile: sign out, or delete the account and what is in the cloud. */
export function AccountEnd() {
  const t = useT()
  const toast = useToast()
  const license = useStore((s) => s.license)
  const storeSub = license?.provider === 'store' && license.status === 'active' && !license.lifetime
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
        {/* Deleting the account leaves a store subscription running. */}
        {IS_APP && (
          <div className="mt-3 space-y-2 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
            <p>{t.account.deleteStore}</p>
            {storeSub && (
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={async () => {
                  const url = await import('../lib/purchases').then((m) => m.manageUrl()).catch(() => null)
                  if (url) window.open(url, '_blank')
                }}
              >
                {t.account.manageStore}
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </SettingsGroup>
  )
}
