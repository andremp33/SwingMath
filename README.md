# SwingMath

Customise a tennis racket with real physics: weight, balance, swingweight,
twistweight, recoil weight and sweet spot, with lead anywhere on the frame.
Strings, grip, arm comfort and a stringing journal. An app for Android and
iPhone (Capacitor), with an optional account, in Portuguese, Spanish and
English. Pro is sold in the App Store and Google Play, through RevenueCat.

**Website:** https://andremp33.github.io/SwingMath/ — the apps' shop window:
what the app does, the store buttons, privacy, terms, support, account
deletion, and previews of shared setups. It is not an app.

```bash
npm install
npm run dev:app    # the app in a browser (app build's mode), for development
npm run dev        # the website
npm test           # unit tests (physics, strings, journal, sync, paywall, delete-account)
npm run e2e        # build + Playwright: the app's flows (desktop, phone) and the website

# Accounts, sync and community, against a local Supabase (needs Docker)
npx supabase start
npm run test:cloud                                  # database rules, webhook, sync
npx playwright test -c playwright.cloud.config.ts   # sign-in, sync, community, in the app
```

`VITE_FAKE_STORE=true npm run dev:app` shows the paywall with pretend plans
in a browser, where there is no App Store or Google Play; it never reaches a
build.

- `src/domain/` — physics, sweet spot, pendulum swingweight, strings, grip, arm comfort, journal, solvers (pure, tested)
- `src/data/` — racket library, local database (IndexedDB), sync with the account
- `src/screens/` — the app's screens; `Landing.tsx` is the website (front page, `/privacidade`, `/termos`, `/suporte`, `/apagar-conta`, `/s/…`, `/ficha/…`)
- `supabase/` — database schema and rules (`migrations/`), the RevenueCat webhook (`functions/rc-webhook`), account deletion (`functions/delete-account`), sign-in email
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

### Private preview (until TestFlight)

`npm run build:preview` builds the app's screens for a phone's browser into
`dist/preview/`; the deploy publishes it at `/SwingMath/preview/`. Nothing
links to it and it is not indexed. Open it in Safari, then Share, Add to Home
Screen. No plugins there: no purchases (the paywall says so), reminders or
share sheet; the export downloads the file. Its own code lives in
`src/preview/` and behind `IS_PREVIEW`, so the store builds do not carry it.

## Going live

**The website.** Set `VITE_APP_STORE_URL` and `VITE_PLAY_STORE_URL` as
repository variables once the apps are in the stores; until then the buttons
say "coming soon". `/apagar-conta` is the account-deletion page Google Play
asks for; `/privacidade` and `/termos` are the links both stores ask for.
Earlier visitors' service worker removes itself (the site is no longer an
app). App Links and Universal Links (`.well-known`) wait for a domain.

**Accounts (Supabase), optional.**

1. Create a project in an EU region. Set the site URL and allow
   `<site>/**` as a redirect URL. Sign-in works with the default email (a
   link). For a code instead (better in the installed app), set up custom SMTP
   first (the free tier only allows template changes with it), then set the
   "Magic Link" and "Confirm signup" templates to `supabase/templates/code.html`
   with the subject `SwingMath: {{ .Token }}`.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables.

The `subscriptions` table (web subscriptions, from an earlier version) stays
in the database and `has_pro` still reads it; nothing writes to it any more.

**Store subscriptions in the apps (RevenueCat).** Apple and Google require
their own billing for subscriptions bought in the apps, so the apps sell Pro
through the App Store and Google Play, via RevenueCat. The apps never link to
the web checkout.

1. In App Store Connect and Google Play Console, create one subscription
   group with two products (monthly and annual), a 7-day free trial on the
   annual one (iOS: an introductory offer; Play: a free-trial offer on its
   base plan), and a one-time (non-consumable) lifetime product.
2. In RevenueCat, add both apps (`app.swingmath`), import the products, make
   an entitlement `pro` with all three, and an offering `default` (set as
   current) with the `$rc_annual`, `$rc_lifetime` and `$rc_monthly`
   packages. Its metadata may set `onboarding_paywall: true` to show the
   plans after the first-launch walkthrough (off unless set).
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

**Deleting an account.** `npx supabase functions deploy delete-account` (it
keeps JWT verification: the player's own token is checked). It uses the
same `RC_SECRET_KEY` to delete the RevenueCat customer, then deletes the
user, and the database removes their data by cascade. Without the key it
refuses (locally, `supabase/config.toml` lets it skip RevenueCat). Until the
function is deployed the app falls back to deleting in the database alone.
Deleting an account does not cancel a store subscription; the app says so
and links to the store's page.

**Email (custom SMTP).** The sign-in code is an email, and Supabase's
built-in sender is only for testing (a few emails an hour, to team
addresses). In Supabase → Authentication → Emails → SMTP settings, fill in
a provider's host, port, user and password (for example Brevo, Resend,
Postmark or Amazon SES, with SPF and DKIM set on your domain), then set the
templates as in step 1 of the accounts above. Name the provider in the
privacy policy if you want to be specific.

**The stores' review account.** Apple and Google reviewers cannot receive
our sign-in emails, so one account signs in with a password instead:

1. In Supabase → Authentication → Users → Add user, create it with an email
   you control (for example `review@yourdomain`), a strong password, and
   "Auto confirm user" on.
2. Set `VITE_REVIEW_EMAIL` to that email for the app builds. Only that email
   shows the password field; everyone else signs in with a code.
3. Give the email and password to the reviewers in App Store Connect (App
   Review Information) and Play Console (App access). Keep the password out
   of the repository.
