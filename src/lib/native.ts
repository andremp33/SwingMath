import { App } from '@capacitor/app'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getCloud } from './cloud'
import { openPath, reminderPath } from './platform'

/** Address the sign-in email's link opens in the store apps. */
export const APP_AUTH_URL = 'app.swingmath://auth'

/** Store apps only: status bar, Android back button, sign-in links. */
export async function initNative() {
  const paintStatusBar = () => {
    const dark = document.documentElement.dataset.theme !== 'light'
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: dark ? '#141312' : '#f5f3ee' }).catch(() => {})
  }
  paintStatusBar()
  new MutationObserver(paintStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  // The splash stays until the first screen has something on it (a screen
  // still loading shows nothing), or 3 s at the most.
  const root = document.getElementById('root')!
  const hide = () => {
    painted.disconnect()
    clearTimeout(late)
    SplashScreen.hide().catch(() => {})
  }
  const painted = new MutationObserver(() => root.innerText.trim() && hide())
  const late = setTimeout(hide, 3000)
  if (root.innerText.trim()) hide()
  else painted.observe(root, { childList: true, subtree: true, characterData: true })
  void import('./purchases')
    .then((m) => m.initPurchases())
    .catch(() => {})

  // iOS: a tap on the status bar scrolls to the top, as in other apps.
  window.addEventListener('statusTap', () => document.getElementById('app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }))

  // Back closes an open sheet first, then goes back, then leaves the app.
  App.addListener('backButton', ({ canGoBack }) => {
    const sheet = document.querySelector<HTMLDialogElement>('dialog[open]')
    if (sheet) sheet.close()
    else if (canGoBack) history.back()
    else App.exitApp()
  })

  // The sign-in link lands here: app.swingmath://auth#access_token=...
  // Shared setups and stringer's sheets from the website: app.swingmath://s/...
  App.addListener('appUrlOpen', async ({ url }) => {
    const page = /^app\.swingmath:\/\/((?:s|ficha)\/[^?#]+)/.exec(url)?.[1]
    if (page) {
      openPath(`/${page}`)
      return
    }
    if (!url.startsWith(APP_AUTH_URL)) return
    const cloud = await getCloud()
    if (!cloud) return
    const u = new URL(url.replace('app.swingmath://', 'https://app.swingmath/'))
    const hash = new URLSearchParams(u.hash.slice(1))
    const code = u.searchParams.get('code')
    if (code) await cloud.auth.exchangeCodeForSession(code)
    else if (hash.get('access_token') && hash.get('refresh_token'))
      await cloud.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! })
    openPath('/perfil')
  })

  // A tap on a restring reminder opens it in the journal.
  LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const id = (notification.extra as { stringingId?: string } | undefined)?.stringingId
    if (id) openPath(reminderPath(id))
  })
}

export async function notifyNative(id: number, title: string, body: string, stringingId: string) {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  await LocalNotifications.schedule({ notifications: [{ id, title, body, extra: { stringingId } }] })
}

export async function nativeNotifyPermission(ask: boolean): Promise<NotificationPermission> {
  const r = ask ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions()
  return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'
}

/** Writes a text file to the app's cache and opens the share sheet with it,
 *  so the player can save it to Files or send it anywhere. */
export async function shareFile(name: string, text: string, title: string) {
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
  // Closing the sheet without choosing rejects; that is not an error.
  await Share.share({ title, files: [uri] }).catch(() => {})
}

/** Opens the share sheet with a message: text and a link. */
export async function shareText(title: string, text: string, url: string) {
  // Closing the sheet without choosing rejects; that is not an error.
  await Share.share({ title, text, url, dialogTitle: title }).catch(() => {})
}

/** The restring reminders, at their dates: whatever was scheduled before is
 *  replaced, so a new stringing or a retired racket drops its old date. */
export async function scheduleRestrings(items: { id: number; at: Date; title: string; body: string; stringingId: string }[]) {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) })
  if (items.length) await LocalNotifications.schedule({ notifications: items.map((i) => ({ id: i.id, title: i.title, body: i.body, schedule: { at: i.at, allowWhileIdle: true }, extra: { stringingId: i.stringingId } })) })
}
