# PWA Auto-Update & Cache Headers

- Added `virtual:pwa-register` usage in `src/main.tsx` to auto-apply new Service Workers and reload.
- Updated `vite.config.ts` with `workbox.clientsClaim/skipWaiting` and `devOptions.enabled`.
- Added `vercel.json` with `Cache-Control` headers (no-cache for HTML/SW/manifest, immutable for assets).
- Added Tailwind `safelist` for classes used by the switch (blue/red) to avoid purge edge cases.

## How to test
1) `npm i` (or `pnpm i`)
2) `npm run build && npm run preview` — open the preview on mobile and verify updates apply.
3) Push to `dev`; check Vercel Preview. Then **Promote to Production** when ready.

## One-time on old phones
If the installed PWA still shows an old version, clear site data once.
With the new config, next updates will apply automatically.