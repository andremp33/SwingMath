import { useEffect, useState } from 'react'
import { useOwned, useSessions, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { currentStringings, dueForRestring, hoursOn, restringDue } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'
import { IS_NATIVE, IS_PREVIEW } from '../lib/platform'
import { bedLabel } from '../ui/strings'

// The app's preview in a browser has no reminders.
const supported = () => IS_NATIVE || (!IS_PREVIEW && typeof window !== 'undefined' && 'Notification' in window)
const permissionNow = (): NotificationPermission => (IS_NATIVE ? 'default' : supported() ? Notification.permission : 'denied')

/** Notification permission for the reminders card. */
export function useReminders() {
  const [permission, setPermission] = useState<NotificationPermission>(permissionNow)
  useEffect(() => {
    // Without the plugin (a browser) the permission stays unknown.
    if (IS_NATIVE)
      void import('../lib/native')
        .then((n) => n.nativeNotifyPermission(false))
        .then(setPermission)
        .catch(() => {})
  }, [])
  return {
    supported: supported(),
    permission,
    enable: async () =>
      setPermission(IS_NATIVE ? await import('../lib/native').then((n) => n.nativeNotifyPermission(true)) : await Notification.requestPermission()),
  }
}

/** A stable notification number for an id. */
const numberFor = (tag: string) => [...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) & 0x7fffffff

/** 19:00 local time on the day something is due. */
export function eveningOf(ms: number): Date {
  const d = new Date(ms)
  d.setHours(19, 0, 0, 0)
  return d
}

async function notify(title: string, body: string, tag: string) {
  if (IS_NATIVE) {
    // A stable number per stringing, so a reminder is not shown twice.
    return import('../lib/native').then((n) => n.notifyNative(numberFor(tag), title, body))
  }
  // Android Chrome only allows notifications through the service worker.
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined)
  if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag })
  else new Notification(title, { body, tag })
}

/**
 * Restring reminders. In the store apps, each racket's restring date is a
 * local notification at 19:00 that day, set again whenever its stringing or
 * sessions change, and dropped for a new stringing or a retired racket. A
 * racket already past its strings' life when the app opens gets one
 * reminder then (the only kind on the web). Returns how many rackets are
 * due, for the dot on the Journal tab.
 */
export function useRestringReminders(): number {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const reminded = useStore((s) => s.reminded)
  const markReminded = useStore((s) => s.markReminded)
  const hoursPerWeek = useStore((s) => s.profile.hoursPerWeek)
  const stringings = useStringings()
  const sessions = useSessions()
  const owned = useOwned()
  const ready = !!(stringings && sessions && owned)
  // Retired rackets are out of the way: no reminders, no dot.
  const inPlay = (s: { ownedId?: string }) => !s.ownedId || !owned?.some((o) => o.id === s.ownedId && o.retired)
  const due = ready ? dueForRestring(stringings!, sessions!).filter(inPlay) : []
  const fresh = due.filter((s) => !reminded.includes(s.id))
  const key = fresh.map((s) => s.id).join()

  const now = Date.now()
  const plan = IS_NATIVE && ready
    ? currentStringings(stringings!)
        .filter((s) => s.ownedId && inPlay(s))
        .map((s) => ({ s, at: eveningOf(restringDue(s, sessions!, hoursPerWeek, now)) }))
        .filter((x) => x.at.getTime() > now)
    : []
  const planKey = plan.map((x) => `${x.s.id}@${x.at.getTime()}`).join()
  useEffect(() => {
    if (!IS_NATIVE || !ready) return
    const name = (id?: string) => owned!.find((o) => o.id === id)?.name ?? ''
    void import('../lib/native')
      .then((n) =>
        n.scheduleRestrings(
          plan.map(({ s, at }) => ({
            id: numberFor(`due:${s.ownedId}`),
            at,
            title: t.journal.notifyTitle,
            body: fmt(t.journal.notifyDueBody, { label: name(s.ownedId), bed: bedLabel(s.bed, t, lang), date: fmtDate(s.date, lang) }),
          })),
        ),
      )
      .catch(() => {})
    // What is scheduled is not sent again when the app opens late.
    if (plan.length) markReminded(plan.map((x) => x.s.id))
    // `planKey` stands for `plan`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, planKey, lang])

  useEffect(() => {
    if (!key || !supported() || (!IS_NATIVE && Notification.permission !== 'granted')) return
    for (const s of fresh) {
      notify(t.journal.notifyTitle, fmt(t.journal.notifyBody, { label: s.label, h: fmtNum(hoursOn(s.id, sessions ?? []), 1, lang), date: fmtDate(s.date, lang) }), s.id).catch(() => {})
    }
    markReminded(fresh.map((s) => s.id))
    // `key` stands for `fresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return due.length
}
