import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getCloud } from './cloud'

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
  SplashScreen.hide().catch(() => {})
  void import('./purchases').then((m) => m.initPurchases())

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
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(APP_AUTH_URL)) return
    const cloud = await getCloud()
    if (!cloud) return
    const u = new URL(url.replace('app.swingmath://', 'https://app.swingmath/'))
    const hash = new URLSearchParams(u.hash.slice(1))
    const code = u.searchParams.get('code')
    if (code) await cloud.auth.exchangeCodeForSession(code)
    else if (hash.get('access_token') && hash.get('refresh_token'))
      await cloud.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! })
    history.pushState({}, '', '/settings')
    dispatchEvent(new PopStateEvent('popstate'))
  })
}

export async function notifyNative(id: number, title: string, body: string) {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  await LocalNotifications.schedule({ notifications: [{ id, title, body }] })
}

export async function nativeNotifyPermission(ask: boolean): Promise<NotificationPermission> {
  const r = ask ? await LocalNotifications.requestPermissions() : await LocalNotifications.checkPermissions()
  return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'
}
