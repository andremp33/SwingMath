// Runs before `vite build --mode app`: a store build must be able to sell
// Pro. Without both RevenueCat keys it stops, unless the Pro beta is asked
// for explicitly (VITE_PRO_BETA=true), which gives Pro to everyone.
import { loadEnv } from 'vite'

const env = loadEnv('app', process.cwd(), 'VITE_')
const missing = ['VITE_RC_IOS_KEY', 'VITE_RC_ANDROID_KEY'].filter((k) => !env[k]?.trim())
const beta = env.VITE_PRO_BETA === 'true'

if (missing.length && !beta) {
  console.error(
    `\nbuild:app stopped: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.\n` +
      'Set the RevenueCat public SDK keys (see .env.example), or build a beta with VITE_PRO_BETA=true.\n',
  )
  process.exit(1)
}
if (beta) console.warn('\nbuild:app: Pro beta is on. Every Pro feature is free in this build.\n')
