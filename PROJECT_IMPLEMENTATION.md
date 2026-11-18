# Probe Web — Implementation Documentation

## 1. Project Overview

Probe is a food-safety operations and evidence platform for independent food businesses. This repository contains the Next.js web control centre, public marketing and printable-template pages, a scoped inspector view and internal-admin metadata search. A separate Flutter app (`probe-app`) uses the same Firebase project and schema.

**Status: Firebase-only foundation, not a production launch.** Since 0.2.0 there is no application server. The site is a static export on Firebase Hosting; the browser talks to Firebase Auth and Cloud Firestore directly. Billing is RevenueCat. Nothing has been deployed or tested against a live Firebase project yet.

## 2. Technology Stack

| Technology                                                 | Purpose                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Next.js 16.4.6 (static export) / React 19.3.1              | Pages and interactive client components; no Node runtime in production           |
| TypeScript 6.0.3                                           | Strict shared domain types                                                       |
| Tailwind CSS 4.3.5 / CSS tokens                            | Styling, responsive layout, dark mode                                            |
| Firebase Auth (web SDK 13.3.0)                             | Email/password, Google, Apple sign-in; email verification                        |
| Cloud Firestore                                            | Organization-scoped data, real-time listeners, **security rules as the backend** |
| Firebase Hosting                                           | Static site, security headers                                                    |
| RevenueCat Web Billing (`@revenuecat/purchases-js` 1.73.2) | Subscriptions; shares entitlements with the mobile app                           |
| Zod                                                        | Command and report validation in the client                                      |
| pdf-lib                                                    | Inspection PDFs and printable logs generated in the browser                      |
| Vitest / Playwright                                        | Domain/codec unit tests and public-site browser tests                            |

Webpack is selected because Turbopack's CSS worker failed on the original Windows host.

## 3. Architecture

- `src/app`: pages. `/app/**` is wrapped by a client `AuthGate` (Firebase session → membership). Dynamic routes use `generateStaticParams`.
- `src/components`: shell, forms, dashboard and `features/` modules (unchanged UI, now fed by Firestore).
- `src/lib/data.ts`: the client data layer — session resolution, signup/invite batches, real-time state, command commits, paging, CSV, reports, share links, admin search.
- `src/lib/firestore-codec.ts`: pure Timestamp ↔ ISO conversion and the state-diff → minimal batched writes.
- `src/services/commands.ts`: pure `applyCommand` domain logic (permissions, validation, auto-issues, audit). The client runs it on a copy of the state and commits the diff as **one atomic batch**.
- `src/lib/billing.ts`: RevenueCat.
- `firestore.rules`: the real enforcement point. `docs/FIREBASE_SCHEMA.md` is the contract.

Client-side checks give fast, friendly errors; the rules decide. Never weaken rules to make a client work.

## 4. Database Model

See **docs/FIREBASE_SCHEMA.md** for every collection, field, type and write recipe. Summary: `users/{uid}` → organization lookup; `organizations/{id}` with subcollections `memberships` (doc ID = uid), `invitations` (doc ID = email), `sites`, `equipment`, `entries` (immutable + amendments), `issues`, `templates`, `templateVersions` (immutable), `schedules`, `dueItems`, `suppliers`, `reports` + `reportSnapshots` (immutable), `notifications`, `notificationPreferences`, `auditEvents` (append-only); top-level `sharedReports/{token}` for inspector links.

Trusted times (`entries.serverTimestamp`, `issues.createdAt`, `auditEvents.at`, `reports.generatedAt`, …) are written with `serverTimestamp()` and checked `== request.time`. The trial ends at `createdAt + 14 days`; `plan` is never client-writable.

## 5. Features

- [x] Marketing pages, responsive UI, dark toggle, dialogs/forms.
- [x] Protected shell, site switcher, log search, mobile drawer, dashboard (real-time).
- [x] Equipment creation, archival, safe-range charts; Owner-only limit changes.
- [x] Temperature/manual capture, automatic excursion issue + notification (enforced by rules), immutable originals, reasoned amendments.
- [x] Cursor-paginated logs with date filtering; full-history CSV export (browser-generated).
- [x] Issues board/list, corrective notes, resolution, manager verification.
- [x] Versioned template builder.
- [x] Supplier directory and delivery records.
- [x] Report builder/history, browser PDF, expiring/revocable inspector links with access counting.
- [x] Team: invitations matched to verified email, role/status changes.
- [x] Audit log, in-app notifications/preferences, business settings.
- [x] Resumable setup progress and account-deletion request capture.
- [x] Public SEO templates and no-signup printable PDF generator (browser-generated).
- [x] Firebase email/Google/Apple sign-in with verification gate and create-or-join workspace.
- [x] RevenueCat checkout and management link (integrated, unverified).
- [x] Internal-admin metadata search (custom claim).
- [ ] Typed checklist execution, required-photo evidence and recurring scheduler.
- [ ] Invitation/notification emails, push dispatch.
- [ ] Uploads (Cloud Storage requires Blaze).
- [ ] Imports, organization ZIP, retention and deletion workers.

## 6. Pages and Routes

| Route                                                                                                                      | Purpose               | Access                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| `/`, `/features`, `/pricing`, `/guides`, `/about`, `/contact`, `/terms`, `/privacy`                                        | Public information    | Public                                                  |
| `/login`, `/signup`, `/forgot-password`                                                                                    | Firebase Auth         | Public                                                  |
| `/app/dashboard`, `/app/{logs,equipment,checklists,issues,suppliers,reports,team,notifications,audit,onboarding,settings}` | Operations            | Owner/Manager (Staff see a "use the mobile app" screen) |
| `/app/settings/{business,limits,notifications,billing}`                                                                    | Settings              | Owner mutations                                         |
| `/inspect#<token>`                                                                                                         | Exact report snapshot | Valid, unrevoked, unexpired token                       |
| `/admin`                                                                                                                   | Organization metadata | `internalAdmin` claim                                   |
| `/templates`, `/templates/[slug]`, `/generator`                                                                            | Free printable tools  | Public                                                  |

## 7. Authentication

Firebase Auth runs in the browser and persists the session. `/app` requires a verified email (`email_verified`), then resolves `users/{uid}` → membership. With no organization, the user either accepts a pending invitation (collection-group query on their verified email) or creates a business (one batch: organization, Owner membership, `main` site, user profile). Sign-out calls Firebase `signOut`.

## 8. Authorization and Roles

`src/lib/permissions.ts` mirrors the rules for UI feedback. In `firestore.rules`: Owner has everything (settings, limits, sites, sharing, deletion request); Manager has operations and manages Staff; Staff capture and work issues only at assigned `siteIds` and cannot read management collections. Membership changes can never create or modify an Owner. Admin access requires the `internalAdmin` custom claim (set by `scripts/set-admin.mjs`).

Inspector tokens are 256 random bits used as the `sharedReports` doc ID; the rules allow a single-document `get` only while unrevoked and unexpired, and only a +1 access-counter update. Listing is Owner-only.

## 9. Security

- Rules enforce tenancy, roles, field allow-lists (`keys().hasOnly`), types/lengths, append-only lists, server timestamps, and cross-document integrity via `getAfter()` (e.g. a non-Done entry must reference an issue created in the same batch; a Temperature reading outside the equipment's range must be `Out of range`).
- No secrets ship to the browser; Firebase web config and the RevenueCat public key are public by design.
- CSV formula prefixes are neutralized; React escapes text; JSON-LD escapes `<`.
- Hosting headers: nosniff, frame denial, referrer policy, permissions policy, HSTS. A CSP is still a launch requirement.
- **Not enforceable without a server:** plan limits (RevenueCat is client-side), rate limiting, report snapshot fidelity (an Owner/Manager could write a fabricated snapshot of their own data), and abuse controls on the public access counter.

## 10. API

There is no HTTP API. Writes are Firestore batches described in `docs/FIREBASE_SCHEMA.md`; domain commands are listed in `src/lib/validation.ts` (`equipment.create/archive`, `entry.create/amend`, `issue.create/transition`, `supplier.create`, `template.save`, `schedule.create`, `team.invite/update/revoke`, `notification.read/preferences`, `settings.save`, `limits.update`, `onboarding.save`, `site.create`, `account.delete-request`).

## 11. Environment Variables

`NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,STORAGE_BUCKET,APP_ID,MESSAGING_SENDER_ID}` and `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`. All are build-time public values. See `.env.example`.

## 12. Setup

See README and docs/DEPLOYMENT.md.

## 13. Testing

- `tests/domain.test.ts`: roles, tenant references, ranges/timing, auto-issues, retry dedupe, amendments, template versions, transitions, link expiry, plan limits, invitations.
- `tests/security.test.ts`: Firestore codec (timestamps, derived trial/timing flags, plan never trusted), command → minimal batched writes with server times, CSV formula neutralization, report and printable PDFs.
- `tests/e2e/workflows.spec.ts`: public routes, browser PDF download, inspector rejection.

**Verification (2026-11-18, after the Firebase-only conversion):** `tsc --noEmit` passed, ESLint passed, **59 unit tests passed**, the production static export built all 37 pages, and **3 Playwright tests passed** against the built `out/` site. `npm audit --omit=dev` reports 0 vulnerabilities (with the `@grpc/grpc-js` 1.14.7 override). Not yet verified: anything against a live Firebase project or the emulators. Firestore rules have **no automated emulator tests yet**; add `@firebase/rules-unit-testing` coverage for every recipe and denial path before launch.

## 14. Remaining Work

### P0 before production

1. Create the Firebase project, deploy rules/indexes, and add emulator-based rules tests for every recipe and denial path.
2. Configure RevenueCat (web + mobile) and test purchase, restore, cancellation and cross-platform entitlement.
3. Complete checklist execution, scheduling and evidence uploads (uploads and schedulers need Blaze/Cloud Functions).
4. CSP, legal content, monitoring.

### Technical debt

- Each signed-in web session opens ~16 real-time listeners (bounded windows). Fine at small scale; watch Firestore read quotas.
- Dashboard/charts use the latest 100 entries; other collections use 250-row time-ordered windows.
- Displayed record times are UTC.

## 15. Known Issues

- Invitations are not emailed; invitees must sign up with the invited email.
- `onboarding.save` renames the first site returned by Firestore, which may not be `main` once there are several sites.
- Unit preference is stored but inputs and limits remain Celsius.
- Legal/contact pages are drafts. Dark mode is not persisted.

## 16. How Probe Works End-to-End

Owner signs up and verifies email → creates a business (atomic batch) → invites team by email → invitee signs up with that email, verifies, accepts → managers create equipment/templates → web or mobile capture writes an entry batch (with issue/notification/audit when it fails; rules enforce it) → managers document corrective action and verify → reports snapshot selected evidence → Owners create expiring `sharedReports` links → inspectors open `/inspect#token` without an account.
