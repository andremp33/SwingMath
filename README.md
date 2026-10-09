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
- `supabase/` — database schema and rules (`migrations/`), the Lemon Squeezy webhook (`functions/ls-webhook`), sign-in email
- `.github/workflows/deploy.yml` — builds and publishes to GitHub Pages on every push to `main`
- `.env.example` — store, accounts and contact settings

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
