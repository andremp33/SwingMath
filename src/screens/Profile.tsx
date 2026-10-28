import { FileText, LifeBuoy, Pencil, RotateCw, Shield, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { syncMe, useMeSync } from '../app/account'
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
import { ActionRow, Button, ChoiceChips, MultiChoiceChips, NumberField, SettingsGroup } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { bedLabel } from '../ui/strings'
import { AccountEnd, AccountGroup } from './AccountCard'
import { FleetGroup } from './Fleet'
import { LifeBar } from './JournalSheets'
import { MeSheet } from './MeEditor'
import { PlanGroup } from './Settings'
import { InfoTip } from '../ui/disclosure'

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
      <div className="mt-8 space-y-7">
        <GameGroup />
        <RacketsGroup />
        <FleetGroup />
        <PlanGroup />
        {cloudConfigured() && <AccountGroup entry />}
        <SettingsGroup title={t.profile.more} footer={<span className="num">{fmt(t.settings.version, { v: __APP_VERSION__ })}</span>}>
          <ActionRow to="/perfil/definicoes" icon={SlidersHorizontal} label={t.profile.settings} hint={t.profile.settingsHint} />
          {SUPPORT_EMAIL && <ActionRow href={`mailto:${SUPPORT_EMAIL}`} icon={LifeBuoy} label={t.profile.support} />}
          <ActionRow to="/termos" icon={FileText} label={t.settings.terms} />
          <ActionRow to="/privacidade" icon={Shield} label={t.settings.privacy} />
        </SettingsGroup>
        {account && <AccountEnd />}
      </div>
    </div>
  )
}

/** The avatar and the player's name (or the page's), whose data this is,
 *  and the way to change the name and photo. */
function ProfileHeader() {
  const t = useT()
  const account = useStore((s) => s.account)
  const me = useStore((s) => s.me)
  const meSync = useMeSync((s) => s.state)
  const [editing, setEditing] = useState(false)
  const name = me.name?.trim()
  return (
    <header className="mb-5 flex items-center gap-4">
      <button type="button" onClick={() => setEditing(true)} aria-label={t.me.changePhotoLabel} className="press shrink-0 rounded-full">
        <Avatar className="size-14 text-base" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{name || t.profile.title}</h1>
        <p className="truncate text-sm text-muted">{account ? account.email : t.profile.local}</p>
        {account && (meSync === 'offline' || meSync === 'failed') && (
          <p role="status" className="mt-0.5 text-xs text-warning">
            {t.me[meSync]}{' '}
            <button type="button" onClick={() => void syncMe()} className="font-semibold underline underline-offset-2">
              {t.me.retry}
            </button>
          </p>
        )}
        {/* Nothing set yet: the invitation goes under the lines, so they keep their width. */}
        {!name && !me.photo && (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)} className="mt-2">
            {t.me.add}
          </Button>
        )}
      </div>
      {(name || me.photo) && (
        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)} aria-label={t.me.edit}>
          {t.common.edit}
        </Button>
      )}
      {editing && <MeSheet onClose={() => setEditing(false)} />}
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
      info={<InfoTip title={t.profile.game}>{t.profile.gameUses}</InfoTip>}
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
  // Today, as the page opened: a racket strung today has nothing to log.
  const [today] = useState(() => new Date().toDateString())
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
                {st && new Date(st.date).toDateString() === today ? (
                  // Strung today already: nothing to log twice.
                  <span className="shrink-0 py-1.5 text-sm text-muted">{t.journal.strungToday}</span>
                ) : (
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
                )}
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
