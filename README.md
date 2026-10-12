# SwingMath

Customise a tennis racket with real physics: weight, balance, swingweight,
twistweight, recoil weight and sweet spot, with lead anywhere on the frame.
Strings, grip, arm comfort and a stringing journal. Offline PWA, optional
account, Portuguese / Spanish / English.

**Live:** https://andremp33.github.io/SwingMath/

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (physics, strings, journal, sync, licence)
npm run e2e        # build + Playwright (desktop, phone, offline)

# Accounts, sync and community, against a local Supabase (needs Docker)
npx supabase start
npm run test:cloud                                  # database rules, webhook, sync
npx playwright test -c playwright.cloud.config.ts   # sign-in, sync, community in the app
```

- `src/domain/` — physics, sweet spot, pendulum swingweight, strings, grip, arm comfort, journal, solvers (pure, tested)
- `src/data/` — racket library, local database (IndexedDB), sync with the account
- `src/screens/` — app screens; `/sobre`, `/privacidade`, `/termos` are the site pages
- `supabase/` — database schema and rules (`migrations/`), the Lemon Squeezy and RevenueCat webhooks (`functions/ls-webhook`, `functions/rc-webhook`), sign-in email
- `.github/workflows/deploy.yml` — builds and publishes to GitHub Pages on every push to `main`
- `.env.example` — store, accounts and contact settings

## Store apps (Android, iOS)

The apps wrap the same web build with Capacitor (`android/`, `ios/`).

```bash
npm run android     # build, sync, open in Android Studio (needs the Android SDK)
npm run ios         # build, sync, open in Xcode (needs a Mac)
npm run app:assets  # regenerate icons and splash screens from the logo
```

In the apps: native status bar and back button, restring reminders as
local notifications, and the sign-in link opens the app
(`app.swingmath://auth`, allowed in Supabase's redirect URLs).

## Going live

**Payments (Lemon Squeezy).** One subscription product with a monthly and an
annual variant, a 7-day trial and license keys on (3 activations). Put the
checkout links, store id and customer portal link in the repository's Actions
variables (names in `.env.example`).

**Accounts (Supabase), optional.**

1. Create a project in an EU region. Set the site URL and allow
   `<site>/**` as a redirect URL. Sign-in works with the default email (a
   link). For a code instead (better in the installed app), set up custom SMTP
   first (the free tier only allows template changes with it), then set the
   "Magic Link" and "Confirm signup" templates to `supabase/templates/code.html`
   with the subject `SwingMath: {{ .Token }}`.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. `npx supabase functions deploy ls-webhook --no-verify-jwt` and
   `npx supabase secrets set LS_WEBHOOK_SECRET=<signing secret> LS_STORE_ID=<id>`.
4. In Lemon Squeezy → Settings → Webhooks, point a webhook at
   `https://<ref>.supabase.co/functions/v1/ls-webhook` with the same signing
   secret and the `subscription_*` events.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables.

**Store subscriptions in the apps (RevenueCat).** Apple and Google require
their own billing for subscriptions bought in the apps, so the apps sell Pro
through the App Store and Google Play, via RevenueCat. The apps never link to
the web checkout.

1. In App Store Connect and Google Play Console, create one subscription
   group with two products (monthly and annual) and a 7-day free trial
   (iOS: an introductory offer; Play: a free-trial offer on each base plan).
2. In RevenueCat, add both apps (`app.swingmath`), import the products, make
   an entitlement `pro` with both products, and an offering `default` (set
   as current) with the `$rc_monthly` and `$rc_annual` packages.
3. Put the public SDK keys in `.env.local` before `npm run android` /
   `npm run ios`: `VITE_RC_IOS_KEY=appl_...` and `VITE_RC_ANDROID_KEY=goog_...`.
4. So Pro follows the account to the website and other devices:
   `npx supabase db push` (table `store_subscriptions`),
   `npx supabase functions deploy rc-webhook --no-verify-jwt`, and
   `npx supabase secrets set RC_WEBHOOK_AUTH=<random value> RC_SECRET_KEY=sk_...`.
   In RevenueCat → Integrations → Webhooks, point at
   `https://<ref>.supabase.co/functions/v1/rc-webhook` with the Authorization
   header set to the same `RC_WEBHOOK_AUTH` value.

Signed in, the RevenueCat user is the account id; a purchase made signed out
moves to the account when the player signs in.
