import { ChevronRight, FileText, LifeBuoy, Pencil, RotateCw, Shield, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { saveStringing, uid } from '../data/db'
import { useAllRackets, useOwned, useSessions, useStringings } from '../data/hooks'
import { useStore, type Profile as GameProfile } from '../data/store'
import { latestOf, lifeOf, restringDue, weeklyHours } from '../domain/journal'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import { GOALS, LEVELS, STYLES } from '../lib/community'
import { fmtDate, fmtNum, LOCALE } from '../lib/format'
import { SUPPORT_EMAIL } from '../lib/owner'
import { Avatar } from '../ui/Avatar'
import { Button, ChoiceChips, MultiChoiceChips, NumberField, SettingsGroup } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { bedLabel } from '../ui/strings'
import { AccountEnd, AccountGroup } from './AccountCard'
import { FleetGroup } from './Fleet'
import { LifeBar } from './JournalSheets'
import { PlanGroup } from './Settings'

/**
 * The player's page: who they are and how much they play at a glance, their
 * game (which steers the calculator), their rackets and when to restring
 * them, their plan and account, then settings, help and the legal pages,
 * with signing out and deleting the account at the end.
 */
export function Profile() {
  const t = useT()
  const account = useStore((s) => s.account)
  return (
    <div className="max-w-2xl">
      <ProfileHeader />
      <Stats />
      <div className="mt-8 space-y-8">
        <GameGroup />
        <RacketsGroup />
        <FleetGroup />
        <PlanGroup />
        {cloudConfigured() && <AccountGroup entry />}
        <SettingsGroup title={t.profile.more}>
          <MenuRow to="/perfil/definicoes" icon={SlidersHorizontal} label={t.profile.settings} hint={t.profile.settingsHint} />
          {SUPPORT_EMAIL && <MenuRow href={`mailto:${SUPPORT_EMAIL}`} icon={LifeBuoy} label={t.profile.support} />}
          <MenuRow to="/termos" icon={FileText} label={t.settings.terms} />
          <MenuRow to="/privacidade" icon={Shield} label={t.settings.privacy} />
          <p className="num py-3.5 text-xs text-muted">{fmt(t.settings.version, { v: __APP_VERSION__ })}</p>
        </SettingsGroup>
        {account && <AccountEnd />}
      </div>
    </div>
  )
}

/** The avatar, the page's name and whose data this is. */
function ProfileHeader() {
  const t = useT()
  const account = useStore((s) => s.account)
  return (
    <header className="mb-5 flex items-center gap-4">
      <Avatar className="size-14 text-base" />
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{t.profile.title}</h1>
        <p className="truncate text-sm text-muted">{account ? account.email : t.profile.local}</p>
      </div>
    </header>
  )
}

/** Three numbers from the journal: rackets in play, hours lately, the next restring. */
function Stats() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const hoursPerWeek = useStore((s) => s.profile.hoursPerWeek)
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  if (!owned || !stringings || !sessions) return <div className="h-[74px]" />
  const inPlay = owned.filter((o) => !o.retired)
  const hours = weeklyHours(sessions).reduce((a, h) => a + h, 0)
  const now = Date.now()
  const dues = inPlay.flatMap((o) => {
    const st = latestOf(o.id, stringings)
    return st ? [restringDue(st, sessions, hoursPerWeek, now, stringings)] : []
  })
  const next = dues.length ? Math.min(...dues) : undefined
  const nextLabel = next === undefined ? '—' : next <= now ? t.profile.today : new Date(next).toLocaleDateString(LOCALE[lang] ?? 'en-GB', { day: 'numeric', month: 'short' })
  return (
    <ul className="grid grid-cols-3 gap-2">
      <Stat label={t.profile.statRackets} value={String(inPlay.length)} />
      <Stat label={t.profile.statHours} value={hours ? fmtNum(hours, 0, lang) : '—'} />
      <Stat label={t.profile.statRestring} value={nextLabel} warn={next !== undefined && next <= now} />
    </ul>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li>
      <Link to="/diario" className="flex h-full flex-col justify-between gap-1 rounded-md bg-surface-2 px-3 py-2.5 hover:bg-surface-2/70">
        <span className={warn ? 'readout text-xl text-warning' : 'readout text-xl'}>{value}</span>
        <span className="text-xs leading-tight text-muted">{label}</span>
      </Link>
    </li>
  )
}

/** Goals, level and style at a glance; edited in a sheet. */
function GameGroup() {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const [editing, setEditing] = useState(false)
  const goals = profile.goals ?? []
  const empty = !goals.length && !profile.level && !profile.style
  const line = [
    profile.level && t.community.levels[profile.level],
    profile.style && t.community.styles[profile.style],
    profile.hoursPerWeek && fmt(t.profile.hoursWeek, { h: profile.hoursPerWeek }),
  ].filter(Boolean)
  return (
    <SettingsGroup
      title={t.profile.game}
      action={
        !empty && (
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
            {t.common.edit}
          </Button>
        )
      }
    >
      {empty ? (
        <div className="space-y-3 py-3.5">
          <p className="text-sm text-muted">{t.profile.gameEmpty}</p>
          <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
            {t.profile.setGame}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 py-3.5">
          {goals.length > 0 && (
            <ul aria-label={t.profile.goals} className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <li key={g} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--c-${g})` }} />
                  {t.community.goals[g]}
                </li>
              ))}
            </ul>
          )}
          {line.length > 0 && <p className="text-sm">{line.join(' · ')}</p>}
          <p className="text-xs text-muted">{t.profile.gameUses}</p>
        </div>
      )}
      {editing && <GameSheet onClose={() => setEditing(false)} />}
    </SettingsGroup>
  )
}

/** Level, style, goals and hours a week: all optional, saved together. */
function GameSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const [draft, setDraft] = useState<GameProfile>(profile)
  const set = (p: Partial<GameProfile>) => setDraft((d) => ({ ...d, ...p }))
  return (
    <Sheet
      open
      onClose={onClose}
      title={t.profile.game}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setProfile(draft)
              onClose()
            }}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <MultiChoiceChips label={t.profile.goals} value={draft.goals ?? []} onChange={(goals) => set({ goals })} max={2} options={GOALS.map((g) => ({ value: g, label: t.community.goals[g] }))} />
        <ChoiceChips label={t.community.level} value={draft.level} onChange={(level) => set({ level })} options={LEVELS.map((l) => ({ value: l, label: t.community.levels[l] }))} />
        <ChoiceChips label={t.community.style} value={draft.style} onChange={(style) => set({ style })} options={STYLES.map((s) => ({ value: s, label: t.community.styles[s] }))} />
        <NumberField label={t.journal.hoursPerWeek} hint={t.journal.hoursPerWeekHint} unit="h" min={0} max={40} value={draft.hoursPerWeek} onChange={(v) => set({ hoursPerWeek: v })} />
      </div>
    </Sheet>
  )
}

/** Each racket in play: its strings now, how much life they have left, and one tap to log a restring. */
function RacketsGroup() {
  const t = useT()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const hoursPerWeek = useStore((s) => s.profile.hoursPerWeek)
  const owned = useOwned()
  const stringings = useStringings()
  const sessions = useSessions()
  const rackets = useAllRackets()
  if (!owned || !stringings || !sessions) return null
  const inPlay = owned.filter((o) => !o.retired)
  return (
    <SettingsGroup title={t.profile.myRackets}>
      {inPlay.length === 0 ? (
        <p className="py-3.5 text-sm text-muted">
          {t.profile.noRackets}{' '}
          <Link to="/diario" className="font-semibold text-accent-text">
            {t.nav.journal}
          </Link>
        </p>
      ) : (
        inPlay.map((o) => {
          const st = latestOf(o.id, stringings)
          const r = rackets.find((x) => x.id === o.racketId)
          const due = st && restringDue(st, sessions, hoursPerWeek, undefined, stringings)
          const when = !st ? t.profile.noStrings : due! <= Date.now() ? t.profile.restringNow : fmt(t.profile.nextRestring, { date: fmtDate(due!, lang) })
          return (
            <div key={o.id} className="py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{[r && `${r.brand} ${r.model}`, st && bedLabel(st.bed, t, lang), when].filter(Boolean).join(' · ')}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCw}
                  aria-label={`${t.profile.strungToday}: ${o.name}`}
                  onClick={async () => {
                    const now = Date.now()
                    await saveStringing({
                      id: uid(),
                      ownedId: o.id,
                      label: o.name,
                      racketId: o.racketId,
                      setupId: st?.setupId ?? o.setupId,
                      date: now,
                      bed: st?.bed ?? useStore.getState().config.strings ?? DEFAULT_STRINGBED,
                      lifeHours: st?.lifeHours,
                      createdAt: now,
                      updatedAt: now,
                    })
                    toast(fmt(t.profile.strungSaved, { name: o.name }))
                  }}
                >
                  {t.profile.strungToday}
                </Button>
              </div>
              {st && (
                <div className="mt-3">
                  <LifeBar life={lifeOf(st, sessions, undefined, stringings)} compact />
                </div>
              )}
            </div>
          )
        })
      )}
    </SettingsGroup>
  )
}

/** A row that goes somewhere: an icon, a name, an optional line, a chevron. */
function MenuRow({ to, href, icon: Icon, label, hint }: { to?: string; href?: string; icon: LucideIcon; label: string; hint?: string }) {
  const body: ReactNode = (
    <>
      <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </>
  )
  const cls = '-mx-1 flex min-h-12 items-center gap-3 rounded-md px-1 py-3 hover:bg-surface-2'
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {body}
    </a>
  )
}
