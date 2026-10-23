import { useEffect, useState } from 'react'
import { useOwned, useSessions, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { currentStringings, dueForRestring, hoursOn, isDormant, lifeOf, restringDue } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'
import { IS_NATIVE, IS_PREVIEW, openPath, reminderPath } from '../lib/platform'
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

/** `tag`: the stringing the reminder is about; a tap opens it. */
async function notify(title: string, body: string, tag: string) {
  if (IS_NATIVE) {
    // A stable number per stringing, so a reminder is not shown twice.
    return import('../lib/native').then((n) => n.notifyNative(numberFor(tag), title, body, tag))
  }
  // Android Chrome only allows notifications through the service worker.
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined)
  if (reg) return reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag })
  const n = new Notification(title, { body, tag })
  n.onclick = () => {
    window.focus()
    openPath(reminderPath(tag))
    n.close()
  }
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
  // Retired rackets, and those no longer played, are out of the way: no
  // reminders, no dot.
  const inPlay = (s: { ownedId?: string }) => !s.ownedId || !(owned?.some((o) => o.id === s.ownedId && o.retired) || isDormant(s.ownedId, stringings!, sessions!))
  const due = ready ? dueForRestring(stringings!, sessions!).filter(inPlay) : []
  const fresh = due.filter((s) => !reminded.includes(s.id))
  const key = fresh.map((s) => s.id).join()

  const now = Date.now()
  const plan = IS_NATIVE && ready
    ? currentStringings(stringings!)
        .filter((s) => s.ownedId && inPlay(s))
        .map((s) => ({ s, at: eveningOf(restringDue(s, sessions!, hoursPerWeek, now, stringings!)) }))
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
            stringingId: s.id,
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
      // Out of hours, the hours played; out of time, the date it was strung.
      const byTime = lifeOf(s, sessions ?? [], Date.now(), stringings ?? []).limit === 'time'
      const body = byTime
        ? fmt(t.journal.notifyDueBody, { label: s.label, bed: bedLabel(s.bed, t, lang), date: fmtDate(s.date, lang) })
        : fmt(t.journal.notifyBody, { label: s.label, h: fmtNum(hoursOn(s.id, sessions ?? []), 1, lang), date: fmtDate(s.date, lang) })
      notify(t.journal.notifyTitle, body, s.id).catch(() => {})
    }
    markReminded(fresh.map((s) => s.id))
    // `key` stands for `fresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return due.length
}
