import { ChevronRight, LifeBuoy, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { saveStringing, uid } from '../data/db'
import { useAllRackets, useOwned, useSessions, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { latestOf, restringDue } from '../domain/journal'
import { DEFAULT_STRINGBED } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { GOALS, LEVELS, STYLES } from '../lib/community'
import { fmtDate } from '../lib/format'
import { SUPPORT_EMAIL } from '../lib/owner'
import { Avatar } from '../ui/Avatar'
import { Button, ChoiceChips, MultiChoiceChips, NumberField, PageTitle, Segmented, SettingsGroup, SettingsRow } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { bedLabel } from '../ui/strings'
import { AccountEnd, AccountGroup } from './AccountCard'
import { FleetGroup } from './Fleet'
import { PlanGroup } from './Settings'

/**
 * The player's page: who they are (account or not), their game, their
 * rackets and when to restring them, their plan, then settings, help and
 * the legal pages, with signing out and deleting the account at the end.
 */
export function Profile() {
  const t = useT()
  const account = useStore((s) => s.account)
  return (
    <div className="max-w-2xl">
      <PageTitle>
        <span className="flex items-center gap-3">
          <Avatar className="size-10 text-sm" />
          {t.profile.title}
        </span>
      </PageTitle>
      <div className="space-y-8 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
        <AccountGroup entry />
        <GameGroup />
        <RacketsGroup />
        <FleetGroup />
        <PlanGroup />
        <SettingsGroup title={t.profile.settings}>
          <Link to="/perfil/definicoes" className="-mx-1 flex min-h-12 items-center justify-between gap-3 rounded-md px-1 py-3 hover:bg-surface-2">
            <span className="text-sm">{t.profile.settingsHint}</span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        </SettingsGroup>
        <SettingsGroup title={t.profile.help}>
          <div className="space-y-3 py-3.5 text-sm">
            <nav aria-label={t.profile.help} className="flex flex-wrap gap-x-5 gap-y-2 font-semibold text-accent-text">
              {SUPPORT_EMAIL && (
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5">
                  <LifeBuoy className="size-4" aria-hidden /> {t.profile.support}
                </a>
              )}
              <Link to="/termos">{t.settings.terms}</Link>
              <Link to="/privacidade">{t.settings.privacy}</Link>
            </nav>
            <p className="num text-xs text-muted">{fmt(t.settings.version, { v: __APP_VERSION__ })}</p>
          </div>
        </SettingsGroup>
        {account && <AccountEnd />}
      </div>
    </div>
  )
}

/** Level, style, goals, hand and hours a week: all optional, all editable. */
function GameGroup() {
  const t = useT()
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  return (
    <SettingsGroup title={t.profile.game}>
      <div className="space-y-4 py-3.5">
        <MultiChoiceChips label={t.profile.goals} value={profile.goals ?? []} onChange={(goals) => setProfile({ goals })} max={2} options={GOALS.map((g) => ({ value: g, label: t.community.goals[g] }))} />
        <ChoiceChips label={t.community.level} value={profile.level} onChange={(level) => setProfile({ level })} options={LEVELS.map((l) => ({ value: l, label: t.community.levels[l] }))} />
        <ChoiceChips label={t.community.style} value={profile.style} onChange={(style) => setProfile({ style })} options={STYLES.map((s) => ({ value: s, label: t.community.styles[s] }))} />
      </div>
      <SettingsRow label={t.profile.hand}>
        <Segmented
          label={t.profile.hand}
          value={profile.hand ?? 'right'}
          onChange={(hand) => setProfile({ hand })}
          options={(['right', 'left'] as const).map((h) => ({ value: h, label: t.profile.hands[h] }))}
        />
      </SettingsRow>
      <SettingsRow label={t.journal.hoursPerWeek} hint={t.journal.hoursPerWeekHint}>
        <NumberField inline label={t.journal.hoursPerWeek} unit="h" min={0} max={40} value={profile.hoursPerWeek} onChange={(v) => setProfile({ hoursPerWeek: v })} />
      </SettingsRow>
    </SettingsGroup>
  )
}

/** Each racket in play: its strings now, when to restring, and one tap to log a restring. */
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
            <SettingsRow key={o.id} label={o.name} hint={[r && `${r.brand} ${r.model}`, st && bedLabel(st.bed, t, lang), when].filter(Boolean).join(' · ')}>
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
            </SettingsRow>
          )
        })
      )}
    </SettingsGroup>
  )
}
