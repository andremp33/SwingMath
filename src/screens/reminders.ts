import { useEffect, useState } from 'react'
import { useSessions, useStringings } from '../data/hooks'
import { isPro, useStore } from '../data/store'
import { dueForRestring, hoursOn } from '../domain/journal'
import { fmt, useT } from '../i18n'
import { fmtDate, fmtNum } from '../lib/format'

const supported = () => typeof window !== 'undefined' && 'Notification' in window

/** Notification permission for the reminders card. */
export function useReminders() {
  const [permission, setPermission] = useState<NotificationPermission>(supported() ? Notification.permission : 'denied')
  return {
    supported: supported(),
    permission,
    enable: async () => setPermission(await Notification.requestPermission()),
  }
}

async function notify(title: string, body: string, tag: string) {
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
  const pro = useStore(isPro)
  const reminded = useStore((s) => s.reminded)
  const markReminded = useStore((s) => s.markReminded)
  const stringings = useStringings()
  const sessions = useSessions()
  const due = stringings && sessions ? dueForRestring(stringings, sessions) : []
  const fresh = due.filter((s) => !reminded.includes(s.id))
  const key = fresh.map((s) => s.id).join()

  useEffect(() => {
    if (!pro || !key || !supported() || Notification.permission !== 'granted') return
    for (const s of fresh) {
      notify(t.journal.notifyTitle, fmt(t.journal.notifyBody, { label: s.label, h: fmtNum(hoursOn(s.id, sessions ?? []), 1, lang), date: fmtDate(s.date, lang) }), s.id).catch(() => {})
    }
    markReminded(fresh.map((s) => s.id))
    // `key` stands for `fresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pro, key])

  return due.length
}
