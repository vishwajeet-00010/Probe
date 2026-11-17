# Probe Web

Food-safety records and inspection reporting for independent food businesses.

**Firebase-only architecture — no application server.** The site is a Next.js static
export served by Firebase Hosting; the browser (and the Probe Flutter app) talk to
Firebase Auth and Cloud Firestore directly. `firestore.rules` is the security boundary.
Billing is RevenueCat (Web Billing + mobile in-app purchases). Everything fits the free
Firebase **Spark** plan.

## Quick start

```powershell
npm install
copy .env.example .env.local   # then fill in your Firebase web config
npm run dev
```

You need a Firebase project (see [deployment](docs/DEPLOYMENT.md)); there is no offline demo mode.

## Commands

```powershell
npm run lint
npm run typecheck
npm test               # unit tests (domain rules, Firestore diff/codec, PDFs)
npm run build          # static export to out/
npm run deploy         # build + firebase deploy (hosting, rules, indexes)
# Static site running (npm run build && npx serve out, or npm run preview):
npx playwright test
```

Node 22+ required.

## Docs

- [docs/FIREBASE_SCHEMA.md](docs/FIREBASE_SCHEMA.md) — collections, fields, write recipes, RevenueCat conventions (shared with the Flutter app)
- [firestore.rules](firestore.rules) — tenant, role and record-integrity enforcement
- [PROJECT_IMPLEMENTATION.md](PROJECT_IMPLEMENTATION.md) — feature inventory, security model, known gaps
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Firebase, RevenueCat and hosting setup
