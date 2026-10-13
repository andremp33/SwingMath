import { defineConfig, devices } from '@playwright/test'
import { env } from './cloud/env'

// Accounts, sync and community against a local Supabase:
//   npx supabase start && npx playwright test -c playwright.cloud.config.ts
export default defineConfig({
  testDir: 'e2e-cloud',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { locale: 'pt-PT', trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  // The same flows on the website and in the app build's mode.
  projects: [
    { name: 'web', use: { baseURL: 'http://localhost:5174' } },
    { name: 'app', use: { baseURL: 'http://localhost:5177' } },
  ],
  webServer: [
    { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey } },
    { command: 'npx vite --mode app --port 5177 --strictPort', url: 'http://localhost:5177', reuseExistingServer: true, env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey } },
  ],
})
