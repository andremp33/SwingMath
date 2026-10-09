/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_LS_STORE_ID?: string
  readonly VITE_LS_CHECKOUT_MONTHLY?: string
  readonly VITE_LS_CHECKOUT_ANNUAL?: string
  readonly VITE_LS_PORTAL_URL?: string
  readonly VITE_PRICE_MONTHLY?: string
  readonly VITE_PRICE_ANNUAL?: string
  readonly VITE_PRICE_CURRENCY?: string
  readonly VITE_TRIAL_DAYS?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_OWNER_NAME?: string
}
