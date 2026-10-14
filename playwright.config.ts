import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  // The app's flows run against the app build's mode (the store apps).
  use: { baseURL: 'http://localhost:5175', locale: 'pt-PT', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /site|preview|iphone/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testIgnore: /site|preview|iphone/ },
    // The website: the apps' shop window and the pages the stores ask for.
    { name: 'site', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' }, testMatch: /site/ },
    // The app on an iPhone at 390 px (WebKit): layout and phone flows.
    { name: 'iphone', use: { ...devices['iPhone 13'] }, testMatch: /[\\/]iphone[\\/]/ },
    // The app's private preview, built, on an iPhone (WebKit).
    { name: 'preview', use: { ...devices['iPhone 13'], baseURL: 'http://localhost:5179' }, testMatch: /preview/ },
  ],
  webServer: [
    // The paid tier's rules (limits, paywall) stay tested with the beta off.
    { command: 'npx vite --mode app --port 5175 --strictPort', url: 'http://localhost:5175', reuseExistingServer: true, env: { VITE_PRO_BETA: 'false' } },
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
    {
      command: 'npm run build:preview -- --outDir dist-e2e/preview && npx vite preview --mode preview --outDir dist-e2e/preview --port 5179 --strictPort',
      url: 'http://localhost:5179/preview/',
      reuseExistingServer: true,
    },
  ],
})
