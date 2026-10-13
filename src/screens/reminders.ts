import { useEffect, useState } from 'react'
import { useSessions, useStringings } from '../data/hooks'
import { useStore } from '../data/store'
import { dueForRestring, hoursOn } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'
import { IS_APP } from '../lib/platform'

const supported = () => IS_APP || (typeof window !== 'undefined' && 'Notification' in window)
const permissionNow = (): NotificationPermission => (IS_APP ? 'default' : supported() ? Notification.permission : 'denied')

/** Notification permission for the reminders card. */
export function useReminders() {
  const [permission, setPermission] = useState<NotificationPermission>(permissionNow)
  useEffect(() => {
    if (IS_APP) void import('../lib/native').then((n) => n.nativeNotifyPermission(false)).then(setPermission)
  }, [])
  return {
    supported: supported(),
    permission,
    enable: async () =>
      setPermission(IS_APP ? await import('../lib/native').then((n) => n.nativeNotifyPermission(true)) : await Notification.requestPermission()),
  }
}

async function notify(title: string, body: string, tag: string) {
  if (IS_APP) {
    // A stable number per stringing, so a reminder is not shown twice.
    const id = [...tag].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) & 0x7fffffff
    return import('../lib/native').then((n) => n.notifyNative(id, title, body))
  }
  // Android Chrome only allows notifications through the service worker.
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined)
  if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag })
  else new Notification(title, { body, tag })
}

/**
 * Restring reminders (Pro): once per stringing, when the app opens and a
 * racket is past its strings' life. Returns how many rackets are due, for
 * the badge on the Journal tab (shown to everyone).
 */
export function useRestringReminders(): number {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const reminded = useStore((s) => s.reminded)
  const markReminded = useStore((s) => s.markReminded)
  const stringings = useStringings()
  const sessions = useSessions()
  const due = stringings && sessions ? dueForRestring(stringings, sessions) : []
  const fresh = due.filter((s) => !reminded.includes(s.id))
  const key = fresh.map((s) => s.id).join()

  useEffect(() => {
    if (!key || !supported() || (!IS_APP && Notification.permission !== 'granted')) return
    for (const s of fresh) {
      notify(t.journal.notifyTitle, fmt(t.journal.notifyBody, { label: s.label, h: fmtNum(hoursOn(s.id, sessions ?? []), 1, lang), date: fmtDate(s.date, lang) }), s.id).catch(() => {})
    }
    markReminded(fresh.map((s) => s.id))
    // `key` stands for `fresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return due.length
}
