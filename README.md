# Probe Web

Food-safety records and inspection reporting for independent food businesses. Next.js, TypeScript, Firebase architecture and a working isolated local demo.

## Quick start

```powershell
npm ci
node scripts/setup-demo.mjs
npm run dev
```

Open [local Probe](http://localhost:3000/login) and choose **Explore with demo data**. No account or external credentials are required for the demo. Setup never overwrites an existing `.env.local`.

## Commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
# App running, Chrome installed:
npx playwright test
```

Node 22+ required. Webpack is selected for this Windows host. Real Firebase/Stripe usage requires operator configuration; email, push, attachments and workers are not activated.

See [PROJECT_IMPLEMENTATION.md](PROJECT_IMPLEMENTATION.md) for the authoritative feature inventory, routes, security and setup; [CHANGELOG.md](CHANGELOG.md) for milestones; and [deployment notes](docs/DEPLOYMENT.md) before staging or launch.
