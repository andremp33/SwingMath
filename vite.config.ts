import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

import pkg from './package.json' with { type: 'json' }

// Absolute address for link previews (og:image); empty locally.
const siteUrl = process.env.SITE_URL ?? ''

// `--mode app` builds the store apps (Capacitor): served from the device's
// root, no service worker (the app already has everything offline).
export default defineConfig(({ mode }) => {
  const app = mode === 'app'
  // Where the site is served from: '/' locally, '/SwingMath/' on GitHub Pages.
  const base = app ? '/' : (process.env.BASE_PATH ?? '/')
  return {
    base,
    // The commit goes next to the version, so support can tell which build a
    // player is on.
    define: { __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA ? `${pkg.version} · ${process.env.GITHUB_SHA.slice(0, 7)}` : pkg.version) },
    plugins: [
      {
        name: 'site-url',
        transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl || base),
      },
      react(),
      tailwindcss(),
      VitePWA({
        disable: app,
        // The website is the apps' shop window now, not an app: the service
        // worker earlier visitors installed is replaced by one that removes
        // itself and its caches.
        selfDestroying: true,
        registerType: 'autoUpdate',
        // Registered in main.tsx, which also checks for updates on return.
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icon.svg'],
        // Nothing to install any more.
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: ['**/og.png', '**/landing/*.png'],
          navigateFallback: `${base}index.html`,
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
