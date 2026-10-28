import { Bell, BellOff, Check, Download, ExternalLink, EyeOff, LandPlot, Languages, Loader2, RotateCcw, Ruler, ShieldCheck, Sparkles, SunMoon, Trash2, Upload } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut } from '../app/account'
import { deleteAll, exportAll, importAll } from '../data/db'
import { accountProActive, isPro, useStore, type Theme, type UnitSystem } from '../data/store'
import { freeProActive } from '../domain/trial'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'
import { fmt, loadLang, useT, type Lang } from '../i18n'
import { PRO_BETA } from '../lib/entitlement'
import { isModerator, moderationQueue } from '../lib/moderation'
import { fmtDate } from '../lib/format'
import { IS_APP, IS_NATIVE } from '../lib/platform'
import { ActionRow, Badge, Button, cx, NumberField, Segmented, SettingsGroup, SettingsRow } from '../ui/basics'
import { BackTitle } from '../ui/BackTitle'
import { useToast } from '../ui/overlay'
import { usePaywall } from './Pro'
import { useTrialDays } from './storePlans'
import { useReminders } from './reminders'
import { InfoTip } from '../ui/disclosure'

/**
 * The profile's settings, as a phone lists them: the app's language and
 * units, how it looks, the player's kit, reminders, then their data, with
 * deleting it last.
 */
export function Settings() {
  const t = useT()
  const s = useStore()

  return (
    <div className="max-w-2xl">
      <BackTitle fallback="/perfil">{t.settings.title}</BackTitle>
      <div className="space-y-7">
        <SettingsGroup title={t.settings.prefs}>
          <SettingsRow icon={Languages} label={t.settings.language} stack>
            <Segmented<Lang>
              label={t.settings.language}
              value={s.lang}
              onChange={(l) => void loadLang(l).then(() => s.setLang(l))}
              options={[
                { value: 'pt', label: 'Português' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
          </SettingsRow>
          <SettingsRow icon={Ruler} label={t.settings.units} stack>
            <Segmented<UnitSystem>
              label={t.settings.units}
              value={s.units}
              onChange={s.setUnits}
              options={[
                { value: 'metric', label: t.settings.unitOptions.metric },
                { value: 'imperial', label: t.settings.unitOptions.imperial },
              ]}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title={t.settings.look}>
          <SettingsRow icon={SunMoon} label={t.settings.theme} stack>
            <Segmented<Theme>
              label={t.settings.theme}
              value={s.theme}
              onChange={s.setTheme}
              options={(['system', 'dark', 'light'] as const).map((v) => ({ value: v, label: t.settings.themes[v] }))}
            />
          </SettingsRow>
          <SettingsRow icon={LandPlot} label={t.settings.court} stack>
            <CourtPicker />
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

/** The courts as they look, lines and all: the app's bar and rail are
 *  painted with the one picked. */
function CourtPicker() {
  const t = useT()
  const court = useStore((s) => s.court)
  const setCourt = useStore((s) => s.setCourt)
  const line = 'absolute bg-white/80'
  return (
    <div role="radiogroup" aria-label={t.settings.court} className="grid grid-cols-3 gap-2.5 sm:w-80">
      {(['clay', 'hard', 'grass'] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={court === v} onClick={() => setCourt(v)} className="press flex flex-col gap-1.5 rounded-lg text-center">
          <span
            data-court-swatch={v}
            aria-hidden
            className={cx(
              'court-swatch relative block h-12 rounded-lg transition-shadow duration-150',
              court === v ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : 'ring-1 ring-border',
            )}
          >
            {/* The court from above: doubles and singles lines, the net, the service boxes. */}
            <span className="absolute inset-x-2.5 inset-y-2 border-[1.5px] border-white/80">
              <span className={cx(line, 'inset-x-0 top-[18%] h-px')} />
              <span className={cx(line, 'inset-x-0 bottom-[18%] h-px')} />
              <span className={cx(line, 'inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2')} />
              <span className={cx(line, 'inset-y-[18%] left-[26%] w-px')} />
              <span className={cx(line, 'inset-y-[18%] right-[26%] w-px')} />
              <span className={cx(line, 'inset-x-[26%] top-1/2 h-px')} />
            </span>
          </span>
          <span className={cx('text-sm', court === v ? 'font-medium text-text' : 'text-muted')}>{t.settings.courts[v]}</span>
        </button>
      ))}
    </div>
  )
}

/** The plan, as a corner of the player's court: free (what Pro adds, and the
 *  store's trial or the plans), Pro until a date, on trial, or lifetime;
 *  manage the subscription in the store, or restore purchases. */
export function PlanGroup() {
  const t = useT()
  const s = useStore()
  const pro = useStore(isPro)
  const paywall = usePaywall()
  const trialDays = useTrialDays()
  const l = s.license
  // Pro may come from a key on this device or from the account.
  const keyActive = l !== null && (l.status ?? 'active') === 'active'

  if (PRO_BETA) return <PlanCard status="Beta" name={t.settings.beta} lines={[t.settings.betaHint]} />
  if (!pro) {
    return (
      <PlanCard status={t.profile.free} free name={t.pro.title} footer={t.paywall.free} restore={IS_NATIVE}>
        <ul className="mt-3 space-y-1.5">
          {(['fleet', 'solver', 'setups', 'sync'] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm">
              <Check className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              {t.paywall.titles[k]}
            </li>
          ))}
        </ul>
        <Button variant="primary" size="lg" icon={Sparkles} className="mt-5 w-full" onClick={() => paywall('profile', { asked: true })}>
          {trialDays ? fmt(t.pro.unlockTrial, { days: trialDays }) : t.settings.seePlans}
        </Button>
      </PlanCard>
    )
  }
  // Pro only from the free days a walkthrough gave before 28 October 2026: what it costs (nothing)
  // and the plans, for after.
  if (!keyActive && !accountProActive(s.accountPro) && freeProActive(s.freeProUntil)) {
    return (
      <PlanCard status="Pro" name={fmt(t.profile.freeProUntil, { date: fmtDate(s.freeProUntil!, s.lang) })} lines={[t.profile.freeProHint]} restore={IS_NATIVE}>
        <Button variant="secondary" size="lg" icon={Sparkles} className="mt-5 w-full" onClick={() => paywall('profile', { asked: true })}>
          {t.settings.seePlans}
        </Button>
      </PlanCard>
    )
  }
  const trialUntil = keyActive && l.trial && l.expiresAt ? fmt(t.profile.trialUntil, { date: fmtDate(Date.parse(l.expiresAt), s.lang) }) : null
  return (
    <PlanCard
      status="Pro"
      name={trialUntil ?? (keyActive ? (l.lifetime ? t.pro.lifetime : t.pro.active) : t.account.proActive)}
      lines={
        keyActive
          ? [
              fmt(t.pro.activeSince, { date: fmtDate(l.activatedAt, s.lang) }),
              l.expiresAt && fmt(l.willRenew === false ? t.pro.endsOn : t.pro.renews, { date: fmtDate(Date.parse(l.expiresAt), s.lang) }),
            ]
          : undefined
      }
      restore={IS_NATIVE && !l?.lifetime}
    >
      {/* Lifetime has nothing to manage; a subscription opens the store's own page. */}
      {l?.provider === 'store' && keyActive && !l.lifetime ? (
        <Button
          variant="secondary"
          size="lg"
          icon={ExternalLink}
          className="mt-5 w-full"
          onClick={async () => {
            const url = await import('../lib/purchases').then((m) => m.manageUrl()).catch(() => null)
            if (url) window.open(url, '_blank')
          }}
        >
          {t.pro.manage}
        </Button>
      ) : null}
    </PlanCard>
  )
}

/** The plan's group: its status by the heading, the card painted as the
 *  player's court, a note below. */
function PlanCard({
  status,
  free,
  name,
  lines,
  restore,
  footer,
  children,
}: {
  status: string
  free?: boolean
  name: string
  lines?: (string | false | null | undefined)[]
  restore?: boolean
  footer?: ReactNode
  children?: ReactNode
}) {
  const t = useT()
  return (
    <SettingsGroup title={t.profile.plan} action={<Badge tone={free ? 'neutral' : 'pro'}>{status}</Badge>} footer={footer} bare>
      <div className="court-card rounded-xl px-6 py-6 shadow-card">
        <p className="text-xl font-semibold tracking-tight">{name}</p>
        {lines?.filter(Boolean).map((line) => (
          <p key={line as string} className="mt-1 text-sm text-muted">
            {line}
          </p>
        ))}
        {children}
        {restore && <RestoreLine />}
      </div>
    </SettingsGroup>
  )
}

/** Store apps: ask the store for purchases made before (new phone, reinstall). */
function RestoreLine() {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-muted">
      {t.profile.restoreLabel}
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        // The line stays short; its tap area does not.
        className="-my-3 inline-flex items-center gap-1 py-3 font-semibold text-text underline decoration-white/60 underline-offset-4"
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
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t.pro.restore}
      </button>
    </p>
  )
}

/** For moderators only: how many hidden recipes wait, and the way there. */
function ModerationRow() {
  const t = useT()
  const account = useStore((s) => s.account)
  const [waiting, setWaiting] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    if (account)
      isModerator()
        .then((yes) => (yes ? moderationQueue().then((q) => q.length) : null))
        .then((n) => alive && setWaiting(n))
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [account])
  if (waiting === null) return null
  return <ActionRow icon={ShieldCheck} tone="accent" label={t.moderation.title} hint={fmt(t.moderation.toReview, { n: waiting })} to="/moderar" />
}

function DataGroup() {
  const hiddenAuthors = useStore((s) => s.hiddenAuthors)
  const showAllAuthors = useStore((s) => s.showAllAuthors)
  const t = useT()
  const toast = useToast()
  const s = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <SettingsGroup title={t.settings.data} info={<InfoTip title={t.settings.data}>{t.settings.dataHint}</InfoTip>}>
      <ModerationRow />
      {hiddenAuthors.length > 0 && (
        <SettingsRow icon={EyeOff} label={fmt(t.community.hiddenCount, { n: hiddenAuthors.length })}>
          <Button variant="secondary" size="sm" onClick={showAllAuthors}>
            {t.community.showAgain}
          </Button>
        </SettingsRow>
      )}
      <ActionRow
        icon={Download}
        label={t.settings.export}
        hint={t.settings.exportHint}
        onClick={async () => {
          const json = JSON.stringify(await exportAll(), null, 2)
          const name = `swingmath-${new Date().toISOString().slice(0, 10)}.json`
          // A download link does nothing inside the app: hand the file to the share sheet.
          if (IS_APP && Capacitor.isNativePlatform()) return import('../lib/native').then((n) => n.shareFile(name, json, t.settings.export))
          const blob = new Blob([json], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = name
          a.click()
          URL.revokeObjectURL(a.href)
        }}
      />
      {/* One child of the list, so the hidden input does not count as a row. */}
      <div>
        <ActionRow icon={Upload} label={t.settings.import} hint={t.settings.importHint} onClick={() => fileRef.current?.click()} />
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
      </div>
      <ActionRow
        icon={Trash2}
        danger
        label={t.settings.deleteAll}
        hint={t.settings.deleteAllHint}
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
      />
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
      {permission === 'granted' ? (
        <SettingsRow icon={Bell} tone="success" label={t.journal.remindersRow} hint={t.journal.remindersHint}>
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="size-4" strokeWidth={2.25} aria-hidden /> {t.journal.remindersOn}
          </span>
        </SettingsRow>
      ) : permission === 'denied' ? (
        <SettingsRow icon={BellOff} tone="warning" label={t.journal.remindersRow} hint={t.journal.remindersBlocked} />
      ) : (
        <SettingsRow icon={Bell} label={t.journal.remindersRow} hint={t.journal.remindersHint}>
          <Button size="sm" icon={Bell} onClick={enable}>
            {t.journal.remindersEnable}
          </Button>
        </SettingsRow>
      )}
    </SettingsGroup>
  )
}
