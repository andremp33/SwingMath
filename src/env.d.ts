/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
/** Which build this is (vite.config.ts), as literals the bundler can fold. */
declare const __APP__: boolean
declare const __NATIVE__: boolean
declare const __PREVIEW__: boolean

interface ImportMetaEnv {
  readonly VITE_RC_IOS_KEY?: string
  readonly VITE_RC_ANDROID_KEY?: string
  readonly VITE_PRO_BETA?: string
  readonly VITE_FAKE_STORE?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_OWNER_NAME?: string
  readonly VITE_OWNER_ADDRESS?: string
  readonly VITE_REVIEW_EMAIL?: string
  readonly VITE_APP_STORE_URL?: string
  readonly VITE_PLAY_STORE_URL?: string
}
