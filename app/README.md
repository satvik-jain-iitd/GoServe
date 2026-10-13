# GoServe app

One installable PWA for customer, kitchen, rider and ops. React, Vite, TypeScript, `vite-plugin-pwa`. See ADR-006.

```bash
cd app
npm ci
npm run dev        # http://localhost:5173
npm run verify     # type check, unit tests, build
npm run test:e2e   # runs against the production build (needs: npx playwright install chromium)
```

- Colours come from `design/tokens.json`. `src/styles/tokens.css` must match it (`tests/unit/tokens.test.ts`).
- The manifest lives in `src/pwa-manifest.ts`. Icons are in `public/icons/` (from `design/brand/`).
- Not here yet: Supabase client, screens, deploy (stories #41 to #56).
