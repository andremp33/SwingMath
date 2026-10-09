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
  use: { baseURL: 'http://localhost:5174', locale: 'pt-PT', trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey },
  },
})
