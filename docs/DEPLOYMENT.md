# Deployment and activation (Firebase only, Spark plan)

Nothing here needs a paid Google Cloud product or a server. Cost at small scale is $0;
watch the free quotas (Firestore 50k reads / 20k writes / 20k deletes per day, Hosting
10 GB/month transfer).

## 1. Firebase project

1. Create a project at console.firebase.google.com (Spark plan is fine).
2. **Authentication** → enable Email/Password (and Google if wanted). Add your Hosting
   domain and `localhost` to _Authorized domains_.
3. **Firestore** → create a database (production mode, region near your users).
4. **Project settings → Your apps → Web app** → copy the config into `.env.local`
   (see `.env.example`). Register the Android/iOS apps with `flutterfire configure` from
   the Flutter project so both clients share this project.
5. Install the CLI and deploy rules + indexes:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add            # pick the project, alias "default"
npm run deploy:rules          # firestore.rules + firestore.indexes.json
```

Indexes take a few minutes to build; queries that need them fail until they finish.

## 2. RevenueCat (billing)

1. Create a RevenueCat project. Add apps: **Web Billing** (connect your Stripe account in
   RevenueCat — Stripe is used _by RevenueCat_, not by Probe), plus App Store / Play Store apps.
2. Entitlements: `pro`, `group`. Offerings with identifiers `pro` and `group`, each with one package.
3. Put the Web Billing public key in `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`; mobile keys go in the
   Flutter app's config.
4. Probe sets RevenueCat `appUserId = organizationId`, so a purchase on any platform unlocks
   the whole team everywhere.

Plan limits are enforced in the apps (rules cannot see RevenueCat). If you later move to
Blaze, install the RevenueCat Firebase extension and add rule checks.

## 3. Build and host

```powershell
npm install
npm run build                 # writes the static site to out/
firebase deploy --only hosting
# or both: npm run deploy
```

`firebase.json` serves `out/` with clean URLs and the security headers
(nosniff, frame denial, referrer policy, permissions policy, HSTS).

## 4. Internal admin (optional)

```powershell
npm install --no-save firebase-admin@14.5.1
gcloud auth application-default login
node scripts/set-admin.mjs <project-id> you@example.com
```

## 5. Testing against the emulators (recommended before launch)

`firebase emulators:start --only auth,firestore,hosting` runs Auth, Firestore (with
these rules) and the static site locally. Requires Java. Write rules tests with
`@firebase/rules-unit-testing` against the recipes in `docs/FIREBASE_SCHEMA.md`.

## What a server-less setup cannot do

No invitation or notification **emails**, no **push** dispatch, no **photo uploads**
(Cloud Storage requires Blaze), no scheduled jobs (recurring due items, retention,
account-deletion execution), and no server-side plan enforcement. Each can be added later
as a small Cloud Function on Blaze without changing the data model.
