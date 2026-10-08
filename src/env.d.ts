/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_LS_CHECKOUT_URL?: string
  readonly VITE_LS_STORE_ID?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_OWNER_NAME?: string
}
