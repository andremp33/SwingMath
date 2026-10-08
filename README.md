# SwingMath

Customise a tennis racket with real physics: weight, balance, swingweight,
twistweight, recoil weight and sweet spot, with lead anywhere on the frame.
Offline PWA, no account, Portuguese / Spanish / English.

**Live:** https://andremp33.github.io/SwingMath/

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (physics, solvers, racket library)
npm run e2e        # build + Playwright (desktop, phone, offline)
```

- `src/domain/` — physics, sweet spot, pendulum swingweight, feel estimate, target and matching solvers (pure, tested)
- `src/data/rackets.ts` — stock library; every frame links to the page its numbers come from
- `src/screens/` — app screens; `/sobre`, `/privacidade`, `/termos` are the site pages
- `.github/workflows/deploy.yml` — builds and publishes to GitHub Pages on every push to `main`
- `.env.example` — store and contact settings for production
