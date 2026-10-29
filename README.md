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
local notifications, Sign in with Apple (iPhone) and Google in their native
sheets (`@capgo/capacitor-social-login`), and the sign-in email's link opens
the app (`app.swingmath://auth`, allowed in Supabase's redirect URLs).

### Private preview (until TestFlight)

`npm run build:preview` builds the app's screens for a phone's browser into
`dist/preview/`; the deploy publishes it at `/SwingMath/preview/`. Nothing
links to it and it is not indexed. Open it in Safari, then Share, Add to Home
Screen. No plugins there: no purchases (the paywall says so), reminders or
share sheet; the export downloads the file. Its own code lives in
`src/preview/` and behind `IS_PREVIEW`, so the store builds do not carry it.

## Ideas for v1.1

- The string's gauge in the stringbed model: today it is only shown (the
  stiffness uses the material's typical value); a thinner string at the same
  tension makes a slightly softer bed.

## Going live

**The website.** Set `VITE_APP_STORE_URL` and `VITE_PLAY_STORE_URL` as
repository variables once the apps are in the stores; until then the buttons
say "coming soon". `/apagar-conta` is the account-deletion page Google Play
asks for; `/privacidade` and `/termos` are the links both stores ask for.
Earlier visitors' service worker removes itself (the site is no longer an
app). App Links and Universal Links (`.well-known`) wait for a domain.

**Accounts (Supabase), optional.**

1. Create a project in an EU region. Set the site URL and allow
   `<site>/**` as a redirect URL. Players sign in with Apple and Google (see
   below); keep the Email provider enabled all the same, for the stores'
   review account and its password. The code by email stays off until the
   app sends email of its own: see "Email (custom SMTP), optional".
2. `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables.

The `subscriptions` table (web subscriptions, from an earlier version) stays
in the database and `has_pro` still reads it; nothing writes to it any more.

**Sign in with Apple and Google.** The way into an account: on the iPhone,
Apple and Google; on Android, Google; in a browser (the preview, `dev:app`),
Apple's popup and Google's own button. Each gives an ID token that the app
hands to Supabase (`signInWithIdToken`, with a nonce), so no screen shows
Supabase's address, and no email of ours is needed. A button only shows once
its ID is set (Apple on the iPhone always: App Store guideline 4.8 asks for
it wherever Google is). The code by email shows only with
`VITE_EMAIL_SIGN_IN=true` (once there is custom SMTP), or in a build with
neither Apple nor Google (development, the tests). With the same email,
Apple, Google and the code reach the same account (Supabase links them by
verified email), so the account ID, which is the RevenueCat user, does not
change. Someone who hides their email from Apple gets an account of its own,
with the relay address.

*Apple Developer* (Certificates, Identifiers & Profiles):

1. Identifiers → the App ID `app.swingmath` → Capabilities → Sign in with
   Apple (as a primary App ID). The app already asks for it
   (`ios/App/App/App.entitlements`); with automatic signing, Xcode updates
   the profile (Signing & Capabilities shows "Sign in with Apple").
2. For browsers: Identifiers → + → Services IDs, `app.swingmath.web`,
   "SwingMath (web)". Enable Sign in with Apple → Configure: primary App ID
   `app.swingmath`, domain `andremp33.github.io`, return URL
   `https://andremp33.github.io/SwingMath/preview/` (each page that shows the
   button needs its own; Apple takes no `localhost`, so Apple in a browser
   cannot be tried locally). Set the repository variable
   `VITE_APPLE_SERVICE_ID=app.swingmath.web`.
3. Keys → + → Sign in with Apple, primary App ID `app.swingmath`. Download
   the `.p8` (it can be downloaded once) and note its Key ID and the Team
   ID; keep it out of the repository. Sign-in does not use it. Deleting an
   account should revoke Apple's tokens with it (not done yet, see below),
   and Supabase would need it only for Apple's redirect flow, which the app
   does not use.
4. Only with the email code on: Services → Sign in with Apple for Email
   Communication → Configure: add the domain (`swingmath.app`) and the
   sender `noreply@swingmath.app`, once its SPF passes (see the email
   section). Without this, codes sent to `@privaterelay.appleid.com`
   addresses never arrive.

*Google Cloud* (one project, console.cloud.google.com):

1. Google Auth Platform → Branding: app name SwingMath, support email
   `swing.math@outlook.com`, logo, home page
   `https://andremp33.github.io/SwingMath/`, privacy `…/privacidade`, terms
   `…/termos`. Audience: External, then Publish app. Data access: only
   `openid`, `email` and `profile`, which need no verification.
2. Clients → Create client:
   - **Web application** "SwingMath web": authorized JavaScript origins
     `https://andremp33.github.io`, `http://localhost`,
     `http://localhost:5173` and `http://localhost:5177` (Google's button
     needs the exact origin; no redirect URIs). Its ID is
     `VITE_GOOGLE_WEB_CLIENT_ID`: a repository variable for the preview, and
     in `.env.local` for the store builds (Android's sheet signs in for this
     client too).
   - **iOS**: bundle ID `app.swingmath`, your Team ID. Its ID is
     `VITE_GOOGLE_IOS_CLIENT_ID` (in `.env.local`). Add its "iOS URL scheme"
     (`com.googleusercontent.apps.…`, the ID reversed) to
     `ios/App/App/Info.plist`, as a second string under the existing
     `CFBundleURLSchemes`; Google's sheet will not open without it.
   - **Android**, twice, package `app.swingmath`: one with the SHA-1 of the
     debug key (`cd android && gradlew signingReport`, variant debug), one
     with the SHA-1 of the Play App Signing key (Play Console → Test and
     release → App integrity → App signing; add the upload key's too if you
     install release builds yourself). The app never uses these IDs: Google
     matches the package and the signature.

*Supabase* → Authentication → Sign In / Providers:

1. **Apple**: enable; Client IDs `app.swingmath,app.swingmath.web`. Leave
   the OAuth secret empty.
2. **Google**: enable; Client IDs `<web client ID>,<iOS client ID>`, web
   first. The client secret is for the redirect flow only: if the form
   insists, paste the web client's. Keep "Skip nonce checks" off: the app
   sends a nonce.
3. Nothing else changes: the review account keeps its password.

*Locally*, against `npx supabase start`: in `supabase/config.toml`, under
`[auth.external.apple]` and `[auth.external.google]`, set `enabled = true`
and the same `client_id` lists (they are public), restart Supabase, and put
the IDs in `.env.local`. Supabase checks the tokens against Apple's and
Google's public keys, so real accounts sign in to a local database. Google
works in a browser at `localhost:5173`; Apple only in an iPhone build.

Only a phone shows Apple's and Google's native sheets: they need a build
with the IDs (the e2e tests have none, so no button there). Apple in a
browser needs the Services ID and the deployed preview.

Not done yet: deleting an account does not revoke Apple's tokens (Apple
asks apps to, with the key of step 3: `delete-account` would exchange the
sign-in's authorization code and revoke it), and Android has no Apple
button (it would need a return page and a function).

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
5. In both stores' listings, the support and privacy contact is
   `swing.math@outlook.com` (also the app's default for `VITE_SUPPORT_EMAIL`).

Pro is tried through the store's free trial only; the app gives no free Pro
of its own any more (those who got it before 28 October 2026 keep it until
its date). The trial shows wherever Pro is offered (the plans, the locks, the
Profile's plan row, the walkthrough's last screen) only when the store says
this player may still take it. Two days before a trial turns into the plan,
the app reminds the player with a local notification (if notifications are
on); after a trial purchase it asks for them.

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

**Community moderation.** Three reports from different players (or one in
ten of those who saved a recipe, when more) hide it until someone reviews it.
To review, make your account a moderator: in Supabase Studio, SQL editor,
`insert into public.moderators (user_id) select id from auth.users where email = '<you>';`.
The app then shows **Moderação** in Settings, with how many wait, and the
queue at `/moderar`: each hidden recipe is shown again, kept hidden, or kept
hidden with its author blocked (`public.blocked_publishers`; delete the row
to unblock). Reviewed reports stop counting and are purged 12 months after
review by a nightly `pg_cron` job. Each account publishes at most 5 recipes
a day: `update public.community_settings set publish_per_day = <n>;`.

**Email (custom SMTP), optional.** The app needs no email today: Apple and
Google sign players in. Supabase's built-in sender only reaches the project's
team (a few emails an hour, from Supabase's address), which is why the code
by email is off. To bring it back, the code has to come from the app's own
address, through a provider, on a domain the app owns: the steps below, then
`VITE_EMAIL_SIGN_IN=true` for the builds (and the repository variable for
the preview).

`swing.math@outlook.com` cannot be the sender. Outlook.com no longer accepts
SMTP with a password (basic authentication, app passwords included) for
personal accounts, only OAuth, which Supabase's SMTP settings do not do; it
also caps sending at a few hundred a day and is not meant for automated
mail. Nor can a provider send *as* @outlook.com: Resend only sends from a
domain you verify, Brevo rewrites a free-mail sender to its own domain, and
mail from @outlook.com sent by anyone but Microsoft fails DMARC alignment
and lands in spam. So that address stays the contact, and the code comes
from a domain of ours:

1. **A domain** (about €10–15 a year; Cloudflare Registrar sells at cost),
   for example `swingmath.app`. The same domain can later carry the website,
   App Links and Universal Links.
2. **Resend** (free: 3,000 emails a month, 100 a day, one domain): Domains →
   Add `swingmath.app` (region EU, Ireland) and add the DNS records it shows:
   the DKIM TXT record, and the SPF TXT and MX records on the `send`
   subdomain it uses for bounces. Then add a DMARC record yourself:
   `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:swing.math@outlook.com`
   (move to `p=quarantine` once the reports look clean). API Keys → create
   one with "Sending access" for that domain only. (Brevo works the same
   way, with 300 emails a day free: authenticate the domain, then use its
   SMTP key.)
3. **The sender is `noreply@swingmath.app`.** It needs no mailbox: Resend
   sends from any address on the verified domain, and nobody reads replies
   (Supabase's SMTP has no Reply-To field anyway). The templates say not to
   reply and give `swing.math@outlook.com` for questions.
4. **Supabase** → Authentication → Emails → SMTP Settings → Enable custom
   SMTP: sender email `noreply@swingmath.app`, sender name `SwingMath`, host
   `smtp.resend.com`, port `465`, username `resend`, password the API key.
   Authentication → Rate Limits then allows 30 emails an hour by default,
   plenty for now.
5. **Templates** (Authentication → Emails → Templates): "Magic Link" and
   "Confirm signup" from `supabase/templates/code.html`, "Change Email
   Address" from `supabase/templates/email-change.html`, each with the
   subject `SwingMath: {{ .Token }}` (as `supabase/config.toml` sets them
   locally).
6. Send yourself a code and check its headers: `dkim=pass`, `spf=pass` and
   `dmarc=pass` for `swingmath.app`. Then put the email code back in the
   privacy policy's account section (`src/i18n/legal.ts`): the code sent to
   the email, and the provider (Resend, Inc., in the US, under the standard
   contractual clauses), which only receives the address and the message.
7. With Sign in with Apple, a player may hide their email behind an Apple
   relay address, which only takes mail from registered senders: see step 4
   of Apple above.

**The stores' review account.** Apple and Google reviewers cannot receive
our sign-in emails, so one account signs in with a password instead:

1. In Supabase → Authentication → Users → Add user, create it with an email
   you control (for example `review@yourdomain`), a strong password, and
   "Auto confirm user" on.
2. Set `VITE_REVIEW_EMAIL` to that email for the app builds. Under Apple and
   Google, "Entrar com a conta de revisão das lojas" then opens the email
   and password fields (with the email code on, that email shows the
   password field instead). No other email signs in with a password.
3. Give the email and password to the reviewers in App Store Connect (App
   Review Information) and Play Console (App access). Keep the password out
   of the repository.
