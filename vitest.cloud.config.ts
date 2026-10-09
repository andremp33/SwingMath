import { defineConfig } from 'vitest/config'

// Integration tests against a local Supabase: npm run test:cloud
export default defineConfig({
  test: { include: ['cloud/**/*.test.ts'], environment: 'node', testTimeout: 20000, fileParallelism: false },
})
