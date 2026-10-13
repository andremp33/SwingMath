import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', locale: 'pt-PT', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /offline|app-/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testIgnore: /offline|app-/ },
    // The store app's own screens (first launch, profile), on a phone.
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:5175' }, testMatch: /app-/ },
    { name: 'offline', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' }, testMatch: /offline/ },
  ],
  webServer: [
    // The paid tier's rules (limits, paywall) stay tested with the beta off.
    { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, env: { VITE_PRO_BETA: 'false' } },
    { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true },
    { command: 'npx vite --mode app --port 5175 --strictPort', url: 'http://localhost:5175', reuseExistingServer: true, env: { VITE_PRO_BETA: 'false' } },
  ],
})
