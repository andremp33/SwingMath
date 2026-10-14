import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

import pkg from './package.json' with { type: 'json' }

// Absolute address for link previews (og:image); empty locally.
const siteUrl = process.env.SITE_URL ?? ''

// The private preview's page, for an iPhone's home screen: full screen with
// the status bar over the app (which keeps clear of it), and not indexed.
const PREVIEW_HEAD = `
    <meta name="robots" content="noindex, nofollow" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`

// `--mode app` builds the store apps (Capacitor): served from the device's
// root, no service worker (the app already has everything offline).
// `--mode preview` builds the same app for a phone's browser, at /preview/
// next to the website, while there is no TestFlight (see src/preview/).
export default defineConfig(({ mode }) => {
  const app = mode === 'app'
  const preview = mode === 'preview'
  // Where the site is served from: '/' locally, '/SwingMath/' on GitHub Pages.
  const site = process.env.BASE_PATH ?? '/'
  const base = app ? '/' : preview ? `${site}preview/` : site
  return {
    base,
    // Builds written while the dev server runs (the e2e preview build in
    // dist-e2e/) must not reload the pages under test.
    server: { watch: { ignored: ['**/dist/**', '**/dist-e2e/**', '**/test-results/**'] } },
    // The commit goes next to the version, so support can tell which build a
    // player is on.
    define: {
      __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA ? `${pkg.version} · ${process.env.GITHUB_SHA.slice(0, 7)}` : pkg.version),
      // Literals, so each build drops the others' code (src/lib/platform.ts).
      __APP__: JSON.stringify(app || preview),
      __NATIVE__: JSON.stringify(app),
      __PREVIEW__: JSON.stringify(preview),
    },
    plugins: [
      {
        name: 'site-url',
        transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl || base),
      },
      {
        name: 'preview-head',
        apply: () => preview,
        // Before Vite reads the page, so the strip's script gets built.
        transformIndexHtml: {
          order: 'pre',
          handler: (html) =>
            html
              .replace(/<title>[^<]*<\/title>/, '<title>SwingMath</title>')
              // Nothing to show in a link preview: the page is private.
              .replace(/\n\s*<meta (?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, '')
              .replace(/(<meta name="apple-mobile-web-app-title"[^>]*>)/, `$1${PREVIEW_HEAD}`)
              // The strip at the top: only this page loads it (src/preview/).
              .replace('</body>', '  <script type="module" src="/src/preview/mount.tsx"></script>\n  </body>'),
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        disable: app || preview,
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
