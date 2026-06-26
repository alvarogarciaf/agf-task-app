# Project-Scoped Agent Rules

## PWA Updates (Service Worker)
- **CRITICAL**: When making code changes that should be shipped to users, you MUST bump the service worker cache version.
- To do this, run `node scripts/bump-sw-version.mjs` (or `npm run build` which runs it).
- You MUST ensure the updated `public/sw.js` file is committed to Git and pushed to the repository.
- Vercel serves the `public/sw.js` file directly from the repository for static assets. If the bumped `sw.js` is not committed, the deployment will serve the old version, and users' browsers will NOT detect the update or show the "update available" banner.
