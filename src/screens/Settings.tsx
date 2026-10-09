import { Download, ExternalLink, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from '../app/account'
import { deleteAll, exportAll, importAll } from '../data/db'
import { isPro, useStore, type Theme } from '../data/store'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'
import { fmt, useT, type Lang } from '../i18n'
import { deactivateLicense, PORTAL_URL, PRICING } from '../lib/entitlement'
import { fmtDate } from '../lib/format'
import { Badge, Button, NumberField, PageTitle, Segmented, SettingsGroup, SettingsRow } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { AccountGroup } from './AccountCard'
import { usePaywall } from './Pro'

/**
 * One column of groups, each a list of rows: name and explanation on the
 * left, one control on the right. Plans and sign-in details open in sheets
 * instead of filling the page.
 */
export function Settings() {
  const t = useT()
  const s = useStore()

  return (
    <div className="max-w-2xl">
      <PageTitle>{t.settings.title}</PageTitle>
      <div className="space-y-8">
        <ProGroup />
        <AccountGroup />

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
          footer={t.settings.massesHint}
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

        <DataGroup />

        <SettingsGroup title={t.settings.about}>
          <div className="space-y-3 py-3.5 text-sm">
            <p className="text-muted">{t.settings.aboutText}</p>
            <nav aria-label={t.settings.about} className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-accent-text">
              <Link to="/sobre">SwingMath</Link>
              <Link to="/privacidade">{t.settings.privacy}</Link>
              <Link to="/termos">{t.settings.terms}</Link>
            </nav>
            <p className="num text-xs text-muted">{fmt(t.settings.version, { v: __APP_VERSION__ })}</p>
          </div>
        </SettingsGroup>
      </div>
    </div>
  )
}

/** Plan status in one row; the plans themselves open in the Pro sheet. */
function ProGroup() {
  const t = useT()
  const s = useStore()
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const l = s.license
  // Pro may come from a key on this device or from the account.
  const keyActive = l !== null && (l.status ?? 'active') === 'active'

  if (!pro) {
    return (
      <SettingsGroup title={t.pro.title}>
        <SettingsRow label={t.settings.free} hint={fmt(t.pro.trial, { days: PRICING.trialDays })}>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => paywall()}>
            {t.settings.seePlans}
          </Button>
        </SettingsRow>
      </SettingsGroup>
    )
  }
  return (
    <SettingsGroup title={t.pro.title} action={<Badge tone="pro">Pro</Badge>}>
      <SettingsRow
        label={keyActive ? t.pro.active : t.account.proActive}
        hint={
          keyActive
            ? [fmt(t.pro.activeSince, { date: fmtDate(l.activatedAt, s.lang) }), l.expiresAt && fmt(t.pro.renews, { date: fmtDate(Date.parse(l.expiresAt), s.lang) })]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {PORTAL_URL && (
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
      {keyActive && l.provider !== 'dev' && (
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

function DataGroup() {
  const t = useT()
  const toast = useToast()
  const s = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <SettingsGroup title={t.settings.data} footer={t.settings.dataHint}>
      <SettingsRow label={t.settings.export} hint={t.settings.exportHint}>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          aria-label={t.settings.export}
          onClick={async () => {
            const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `swingmath-${new Date().toISOString().slice(0, 10)}.json`
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
