import { Bell, Download, ExternalLink, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { signOut } from '../app/account'
import { deleteAll, exportAll, importAll } from '../data/db'
import { isPro, useStore, type Theme } from '../data/store'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'
import { fmt, useT, type Lang } from '../i18n'
import { deactivateLicense, PORTAL_URL, PRICING, PRO_BETA } from '../lib/entitlement'
import { fmtDate } from '../lib/format'
import { IS_APP } from '../lib/platform'
import { Badge, Button, NumberField, Segmented, SettingsGroup, SettingsRow } from '../ui/basics'
import { BackTitle } from '../ui/BackTitle'
import { useToast } from '../ui/overlay'
import { usePaywall } from './Pro'
import { useReminders } from './reminders'
import { InfoTip } from '../ui/disclosure'

/**
 * The profile's settings: one column of groups, each a list of rows, name
 * and explanation on the left, one control on the right.
 */
export function Settings() {
  const t = useT()
  const s = useStore()

  return (
    <div className="max-w-2xl">
      <BackTitle fallback="/perfil">{t.settings.title}</BackTitle>
      <div className="space-y-8 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
        <SettingsGroup title={t.settings.prefs}>
          <SettingsRow label={t.settings.language} stack>
            <Segmented<Lang>
              label={t.settings.language}
              value={s.lang}
              onChange={s.setLang}
              options={[
                { value: 'pt', label: 'Português' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label={t.settings.theme} stack>
            <Segmented<Theme>
              label={t.settings.theme}
              value={s.theme}
              onChange={s.setTheme}
              options={(['system', 'dark', 'light'] as const).map((v) => ({ value: v, label: t.settings.themes[v] }))}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup
          title={t.settings.equipment}
          info={<InfoTip title={t.settings.equipment}>{t.settings.massesHint}</InfoTip>}
          action={
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => s.setMasses(DEFAULT_ACCESSORY_MASSES)}>
              {t.common.reset}
            </Button>
          }
        >
          {(['strings', 'overgrip', 'leatherGrip', 'dampener', 'sleeve'] as const).map((k) => (
            <SettingsRow key={k} label={t.acc[k]}>
              <NumberField inline label={t.acc[k]} unit="g" min={0} max={40} value={s.masses[k]} onChange={(v) => v !== undefined && s.setMasses({ [k]: v })} />
            </SettingsRow>
          ))}
          <SettingsRow label={t.settings.tape} hint={t.settings.tapeHint}>
            <NumberField inline label={t.settings.tapeMass} unit="g" min={0.5} max={30} value={s.tapeGPer10cm} onChange={s.setTape} />
          </SettingsRow>
        </SettingsGroup>

        <RemindersGroup />

        <DataGroup />
      </div>
    </div>
  )
}

/** The plan in one row: free (see plans), on trial until a date, Pro or
 *  lifetime; manage the subscription in the store, or restore purchases. */
export function PlanGroup() {
  const t = useT()
  const s = useStore()
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const l = s.license
  // Pro may come from a key on this device or from the account.
  const keyActive = l !== null && (l.status ?? 'active') === 'active'

  if (PRO_BETA) {
    return (
      <SettingsGroup title={t.pro.title} action={<Badge tone="pro">Beta</Badge>}>
        <SettingsRow label={t.settings.beta} hint={t.settings.betaHint} />
      </SettingsGroup>
    )
  }
  if (!pro) {
    return (
      <SettingsGroup title={t.profile.plan}>
        <SettingsRow label={t.profile.free} hint={IS_APP ? t.paywall.free : fmt(t.pro.trial, { days: PRICING.trialDays })}>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => paywall('profile', { asked: true })}>
            {t.settings.seePlans}
          </Button>
        </SettingsRow>
        {IS_APP && <RestoreRow />}
      </SettingsGroup>
    )
  }
  const trialUntil = keyActive && l.trial && l.expiresAt ? fmt(t.profile.trialUntil, { date: fmtDate(Date.parse(l.expiresAt), s.lang) }) : null
  return (
    <SettingsGroup title={t.profile.plan} action={<Badge tone="pro">Pro</Badge>}>
      <SettingsRow
        label={trialUntil ?? (keyActive ? (l.lifetime ? t.pro.lifetime : t.pro.active) : t.account.proActive)}
        hint={
          keyActive
            ? [
                fmt(t.pro.activeSince, { date: fmtDate(l.activatedAt, s.lang) }),
                l.expiresAt && fmt(l.willRenew === false ? t.pro.endsOn : t.pro.renews, { date: fmtDate(Date.parse(l.expiresAt), s.lang) }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {/* Lifetime has nothing to manage; a subscription opens the store's own page. */}
        {l?.provider === 'store' && keyActive && !l.lifetime ? (
          <Button
            variant="secondary"
            size="sm"
            icon={ExternalLink}
            onClick={async () => {
              const url = await import('../lib/purchases').then((m) => m.manageUrl()).catch(() => null)
              if (url) window.open(url, '_blank')
            }}
          >
            {t.pro.manage}
          </Button>
        ) : PORTAL_URL && !IS_APP && (
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-2"
          >
            {t.pro.manage} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </SettingsRow>
      {IS_APP && !l?.lifetime && <RestoreRow />}
      {keyActive && l.provider === 'lemonsqueezy' && (
        <SettingsRow label={t.pro.deactivate}>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await deactivateLicense(l)
              s.setLicense(null)
            }}
          >
            {t.settings.deleteShort}
          </Button>
        </SettingsRow>
      )}
    </SettingsGroup>
  )
}

/** Store apps: ask the store for purchases made before (new phone, reinstall). */
function RestoreRow() {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <SettingsRow label={t.profile.restoreLabel}>
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const ok = await import('../lib/purchases').then((m) => m.restore())
            toast(ok ? t.pro.restored : t.pro.nothingToRestore)
          } catch {
            toast(t.pro.storeError)
          } finally {
            setBusy(false)
          }
        }}
      >
        {t.pro.restore}
      </Button>
    </SettingsRow>
  )
}

function DataGroup() {
  const t = useT()
  const toast = useToast()
  const s = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <SettingsGroup title={t.settings.data} info={<InfoTip title={t.settings.data}>{t.settings.dataHint}</InfoTip>}>
      <SettingsRow label={t.settings.export} hint={t.settings.exportHint}>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          aria-label={t.settings.export}
          onClick={async () => {
            const json = JSON.stringify(await exportAll(), null, 2)
            const name = `swingmath-${new Date().toISOString().slice(0, 10)}.json`
            // A download link does nothing inside the app: hand the file to the share sheet.
            if (IS_APP) return import('../lib/native').then((n) => n.shareFile(name, json, t.settings.export))
            const blob = new Blob([json], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = name
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          {t.settings.exportShort}
        </Button>
      </SettingsRow>
      <SettingsRow label={t.settings.import} hint={t.settings.importHint}>
        <Button variant="secondary" size="sm" icon={Upload} aria-label={t.settings.import} onClick={() => fileRef.current?.click()}>
          {t.settings.importShort}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const r = await importAll(JSON.parse(await f.text()))
              toast(fmt(t.settings.imported, { r: r.rackets, s: r.setups }))
            } catch {
              toast(t.settings.importError)
            }
          }}
        />
      </SettingsRow>
      <SettingsRow label={t.settings.deleteAll} hint={t.settings.deleteAllHint} danger>
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          aria-label={t.settings.deleteAll}
          onClick={async () => {
            if (!confirm(t.settings.deleteAllConfirm)) return
            await deleteAll()
            // The account keeps its cloud copy; sign out so this device
            // does not half-sync an empty database.
            if (s.account) await signOut()
            s.setSync({ userId: null, cursor: null, lastAt: undefined, error: undefined })
            s.clearCompare()
            s.resetConfig()
            toast(t.common.deleted)
          }}
        >
          {t.settings.deleteShort}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  )
}

/** Restring reminders: a notification on the day a racket's strings run out. */
function RemindersGroup() {
  const t = useT()
  const { supported, permission, enable } = useReminders()
  if (!supported) return null
  return (
    <SettingsGroup title={t.journal.reminders}>
      {(
        <SettingsRow label={t.journal.remindersRow} hint={permission === 'denied' ? t.journal.remindersBlocked : t.journal.remindersHint}>
          {permission === 'granted' ? (
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Bell className="size-4" aria-hidden /> {t.journal.remindersOn}
            </span>
          ) : permission === 'denied' ? null : (
            <Button size="sm" icon={Bell} onClick={enable}>
              {t.journal.remindersEnable}
            </Button>
          )}
        </SettingsRow>
      )}
    </SettingsGroup>
  )
}
