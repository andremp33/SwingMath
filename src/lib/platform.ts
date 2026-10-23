/** True in the store apps (Capacitor build, `vite build --mode app`) and in
 *  their preview: the app's screens, not the website. */
export const IS_APP = __APP__

/** The store apps themselves, where the native plugins and the stores are. */
export const IS_NATIVE = __NATIVE__

/** The store apps' private preview in a phone's browser (`vite build --mode
 *  preview`, served at /preview/): the app's screens, without the native
 *  plugins or the stores. Removed once TestFlight takes over. */
export const IS_PREVIEW = __PREVIEW__

/** Goes to a page of the app from outside it (a link into the app, a
 *  notification): the router follows the history. */
export function openPath(path: string) {
  history.pushState({}, '', path)
  dispatchEvent(new PopStateEvent('popstate'))
}

/** Where a restring reminder opens: the journal, with its sheet. */
export const reminderPath = (stringingId: string) => `/diario?lembrete=${encodeURIComponent(stringingId)}`
