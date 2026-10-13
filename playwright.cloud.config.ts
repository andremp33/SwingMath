import { defineConfig, devices } from '@playwright/test'
import { env, REVIEW_EMAIL } from './cloud/env'

// Accounts, sync and community against a local Supabase:
//   npx supabase start && npx playwright test -c playwright.cloud.config.ts
export default defineConfig({
  testDir: 'e2e-cloud',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { locale: 'pt-PT', trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  // Accounts and the community live in the store apps.
  projects: [{ name: 'app', use: { baseURL: 'http://localhost:5177' } }],
  webServer: [
    { command: 'npx vite --mode app --port 5177 --strictPort', url: 'http://localhost:5177', reuseExistingServer: true, env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey, VITE_REVIEW_EMAIL: REVIEW_EMAIL } },
  ],
})
