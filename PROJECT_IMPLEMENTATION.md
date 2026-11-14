# Probe Web — Implementation Documentation

## 1. Project Overview

Probe is a food-safety operations and evidence platform for independent food businesses. This repository contains a working Next.js application, public marketing and printable-template pages, a server API, an isolated local demonstration backend, a Firebase adapter, a scoped inspector view and internal-admin metadata search.

**Status: working first-phase foundation, not a production launch.** The local demo persists real application mutations using synthetic records. External integrations are not represented as live without credentials. The supplied pasted brief was the only PRD present; no separate priority-tagged PRD or existing application was found.

## 2. Technology Stack

| Technology                      | Purpose and reason                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Next.js 16.4.6 / React 19.3.1   | App Router, server-rendered layouts/pages, route handlers and interactive client components |
| TypeScript 6.0.3                | Strict shared domain and API types                                                          |
| Tailwind CSS 4.3.5 / CSS tokens | Consistent neutral/green styling, responsive breakpoints and dark mode                      |
| Firebase Auth / Admin SDK       | Verified server sessions and organization provisioning                                      |
| Firestore                       | Organization-scoped subcollections and transactional writes                                 |
| Firebase Storage                | Deny-by-default rules and typed storage contract; uploads pending                           |
| Stripe SDK                      | Checkout, Customer Portal and verified webhook adapter                                      |
| Zod                             | Runtime validation of sessions, commands and reports                                        |
| pdf-lib                         | Actual server-generated inspection PDFs and public printable logs                           |
| Lucide React                    | Consistent functional icons                                                                 |
| Vitest / Playwright             | Domain/security tests and browser/API workflows                                             |
| ESLint / Prettier               | Static checks and readable source formatting                                                |

Dependencies are pinned in package.json and package-lock.json. Node 22+ is required; this workspace uses Node 24. Webpack is explicitly selected because the installed Turbopack CSS worker failed on this Windows host both inside and outside the sandbox. The supported Webpack production build succeeds. A transitive gRPC override pins 1.14.7; the production dependency audit reports zero vulnerabilities after this patch.

## 3. Architecture

- `src/app`: server pages, authenticated layout and API routes; auth route group, `/app`, `/inspect`, `/admin` and public surfaces.
- `src/components`: shared shell, forms, dialogs, context and dashboard; `features/` contains separate operational modules.
- `src/types/domain.ts`: shared entity types.
- `src/lib`: auth, repository adapters, permissions, schemas, domain helpers, PDF and CSV.
- `src/services`: command mutations, report/link services and integration contracts.
- `tests`: unit/security tests and `e2e/` browser/API tests.
- `scripts/setup-demo.mjs`: non-overwriting local environment setup.

The server resolves actor and membership before returning a bounded operational snapshot. Client forms submit validated commands; the service performs tenant, permission and plan checks before repository writes. Client-side role checks are presentation only.

Production paths are `/organizations/{organizationId}/{collection}/{id}`. Tenant IDs derive from verified membership, never arbitrary request-body organization IDs. Mutations use Firestore transactions and persist changed documents. Targeted point reads preserve old-record amendment and retry idempotency beyond the operational page. Logs use server cursor pagination and export streams pages.

Demo storage is a separate JSON file per signed organization, with a per-process mutex and atomic replacement. It is local single-process storage, not a scalable production database. No production credentials silently fall back to demo.

## 4. Database Model

All tenant-owned records contain organizationId; the organization root's id is its tenant key.

| Entity / collection                | Important fields and relationships                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Organization / organizations       | Business identity, address, registration, region, units, timezone, plan/trial, onboarding state, deletion request         |
| User / users                       | Firebase UID to organization lookup; credentials remain in Firebase Auth                                                  |
| Site / sites                       | Organization, name and address                                                                                            |
| Membership / memberships           | UID, name/email, role/status, assigned site IDs, last-active field; historical users retained                             |
| Equipment / equipment              | Site, name/type/location, Celsius min/max, frequency label, archive flag                                                  |
| Template / templates               | Name/category, current immutable version ID, archive flag                                                                 |
| TemplateVersion / templateVersions | Version number, ordered tasks, section/type/required fields, corrective prompt                                            |
| Schedule / schedules               | Template/site, cadence/time/assignee; definition stored, worker pending                                                   |
| DueItem / dueItems                 | Equipment/version reference, due/completed timestamps, status and assignee                                                |
| Entry / entries                    | Original result, type, site/equipment/version/supplier, actor, server/device times, timing flag, issue and attachment IDs |
| Amendment / embedded in Entry      | Corrected value, reason, actor and timestamp; original unchanged                                                          |
| Issue / issues                     | Severity, source entry, equipment/site, assignee, due date, state and corrective timeline                                 |
| Attachment                         | Type and storage contract only; upload implementation pending                                                             |
| Supplier / suppliers               | Contact, categories and notes; deliveries use Entry.supplierId                                                            |
| Report / reports                   | Immutable date/site/section-scoped entries/issues snapshot, business identity, generator, watermark                       |
| ShareLink / shareLinks             | Token hash, report, expiry/revocation, access count and last access                                                       |
| Notification / notifications       | Event text/type, timestamp, destination and per-user readBy                                                               |
| NotificationPreference             | User email/push settings and quiet hours; dispatch pending                                                                |
| AuditEvent / auditEvents           | Actor/time/action/entity, organization, serialized relevant old/new values, metadata                                      |
| Subscription / subscriptions       | Stripe IDs, status/plan and last provider event time                                                                      |
| stripeEvents                       | Server-only webhook deduplication markers                                                                                 |

## 5. Features Implemented

Status meanings: Implemented = real local/server behavior; Integrated, unverified = provider code requires configuration/testing; Partial = identified gaps; Planned = no working end-to-end feature.

- [x] Implemented: marketing pages, responsive green UI, dark toggle, semantic statuses and shared dialogs/forms.
- [x] Implemented: isolated signed demo sessions and synthetic Green Table Café data.
- [x] Implemented: protected shell, site switcher, log search, mobile drawer and dashboard.
- [x] Implemented: equipment creation, archival, safe-range charts and details.
- [x] Implemented: temperature/manual capture, automatic excursion issue/notification, immutable originals and reasoned amendments.
- [x] Implemented: cursor-paginated logs, date filtering and full record CSV export.
- [x] Implemented: issues board/list, corrective notes, resolution and manager verification.
- [x] Implemented: versioned template builder, sections, task types, drag and keyboard ordering.
- [x] Implemented: supplier directory and delivery record capture.
- [x] Implemented: report builder/history, real server PDF, scoped expiring/revocable inspector links and access counting.
- [x] Implemented: team invitation records, eligible role changes, deactivation and revoke.
- [x] Implemented: audit log, in-app notifications/preferences, business settings and audited limits.
- [x] Implemented: resumable ten-step setup progress and account-deletion request capture.
- [x] Implemented: three public SEO templates, FAQ structured data and no-signup printable PDF generator.
- [x] Integrated, unverified: Firebase password/Google/Apple flows, verification/reset, secure sessions and Firestore persistence.
- [x] Integrated, unverified: Stripe checkout/portal/webhook, subscription projection and no-card trial model.
- [x] Partial: internal-admin claim guard and metadata-only organization search.
- [ ] Typed checklist execution, required-photo evidence and recurring scheduler.
- [ ] Invite email delivery, acceptance and resend; FCM/email dispatch.
- [ ] Safe uploads, signed downloads, scanning and storage quotas.
- [ ] Bulk CSV imports, organization ZIP, retention and final-deletion workers.
- [ ] Provider configuration, production legal content and deployment.

## 6. Pages and Routes

| Route                                           | Purpose                    | Access                              | Status                                      |
| ----------------------------------------------- | -------------------------- | ----------------------------------- | ------------------------------------------- |
| `/`                                             | Homepage                   | Public                              | Implemented                                 |
| `/features`, `/pricing`, `/guides`, `/about`    | Product information        | Public                              | Implemented; paid amounts not invented      |
| `/contact`, `/terms`, `/privacy`                | Operator/legal information | Public                              | Explicit preview drafts                     |
| `/login`, `/signup`, `/forgot-password`         | Auth/demo                  | Public                              | Provider integration unverified; demo works |
| `/app`, `/app/dashboard`                        | Operations                 | Owner/Manager                       | Implemented, bounded data                   |
| `/app/onboarding`                               | Resumable setup            | Owner mutations                     | Partial guided setup                        |
| `/app/logs`                                     | Logs/amendments            | Owner/Manager                       | Implemented; secondary filters page-local   |
| `/app/equipment`                                | Equipment/charts           | Owner/Manager                       | Implemented, bounded chart history          |
| `/app/checklists`                               | Template builder           | Owner/Manager                       | Builder works; execution/scheduler partial  |
| `/app/issues`, `/app/suppliers`                 | Operations                 | Owner/Manager                       | Implemented                                 |
| `/app/reports`                                  | Inspection evidence        | Owner/Manager reports; Owner shares | Implemented with explicit synchronous cap   |
| `/app/team`                                     | Team access                | Owner; Manager manages Staff        | Invite delivery/acceptance pending          |
| `/app/notifications`, `/app/audit`              | Alerts/history             | Owner/Manager                       | Implemented, bounded snapshots              |
| `/app/settings[/business]`, `/limits`           | Business and limits        | Owner mutations                     | Implemented                                 |
| `/app/settings/notifications`                   | Personal preferences       | Owner/Manager                       | Stored; dispatch pending                    |
| `/app/settings/billing`                         | Plans/provider flows       | Owner actions                       | Provider unverified                         |
| `/inspect/[token]`                              | Exact report snapshot      | Valid bearer link                   | Implemented                                 |
| `/admin`                                        | Organization metadata      | internalAdmin claim, no demo        | Search only                                 |
| `/templates`, `/templates/[slug]`, `/generator` | Free printable tools       | Public                              | Implemented                                 |

Staff see a restricted web landing screen. The API supports capture at assigned sites, not management snapshots. A separate mobile app is not included.

## 7. Authentication

Firebase client SDK handles password/provider login. Signup sends verification email. The server verifies a recent ID token, requires verified email, atomically provisions an organization/site/Owner membership when needed and issues a one-day HttpOnly, SameSite=Lax cookie, Secure in production. Each authenticated request checks revocation and active membership. Client Firebase auth is signed out after session exchange. Password reset uses Firebase email.

Demo requires explicit PROBE_DEMO_ENABLED=true and a random 32+ character SESSION_SECRET. Every session receives an independent UUID organization and an HMAC-signed expiring cookie. No fixed passwords or real credentials are committed. Sign-out clears application cookies. Google/Apple require Firebase console/provider setup.

## 8. Authorization and Roles

`src/lib/permissions.ts` owns the permission matrix. Owner has organization/settings/billing/share/deletion rights. Manager has operational/template/issue/report rights and can manage Staff, not promote managers or alter Owners. Staff can only capture at assigned sites. Inactive users remain referenced by historical entries.

Admin requires trusted Firebase internalAdmin=true, never an email match or request parameter. Metadata search excludes operational record content. Impersonation is not enabled.

Inspector tokens contain an organization locator plus 256 random bits. Only SHA-256 hashes are stored. Tokens resolve exactly one immutable report and are checked for expiry/revocation while access counters update. They do not grant general organization access.

## 9. Major Features

| Feature            | Code                                                              | Data                                    |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Dashboard          | components/dashboard.tsx, app-provider.tsx                        | dueItems, entries, issues               |
| Equipment/logs     | features/equipment.tsx, logs.tsx, forms.tsx; services/commands.ts | equipment, entries, issues, auditEvents |
| Templates          | features/checklists.tsx, template.save                            | templates, templateVersions             |
| Corrective actions | features/issues.tsx, lib/domain.ts                                | issues and timeline                     |
| Reports/inspector  | features/reports.tsx, services/reports.ts, lib/reports.ts         | reports, shareLinks, scoped evidence    |
| Team/settings      | features/team.tsx, settings.tsx, central permissions              | memberships, organization, preferences  |
| Public generator   | app/api/generator/route.ts                                        | No stored submissions                   |

## 10. API / Server Actions

Mutation routes require matching Origin except the signed Stripe webhook. JSON inputs are bounded and validated. There are no deployed Cloud Functions.

| Method / path               | Purpose / permission                                           |
| --------------------------- | -------------------------------------------------------------- |
| POST, DELETE `/api/session` | Verified session or explicit demo; clear cookies               |
| GET `/api/state`            | Bounded Owner/Manager snapshot                                 |
| POST `/api/commands`        | Validated domain command with action-specific permissions      |
| GET `/api/entries`          | 50-row cursor page, optional ISO start/end; Owner/Manager      |
| GET `/api/export`           | Stream complete record CSV; Owner/Manager                      |
| POST `/api/reports`         | Snapshot report; Owner/Manager                                 |
| GET `/api/reports/[id]`     | PDF from saved same-tenant snapshot                            |
| POST, DELETE `/api/shares`  | Create/revoke link; Owner                                      |
| POST `/api/billing`         | Checkout/portal; Owner, provider configured, no demo           |
| POST `/api/billing/webhook` | Signature verification, deduplication, subscription projection |
| GET `/api/generator`        | Public rate-limited PDF, max 20 units                          |

Commands: equipment.create/archive, entry.create/amend, issue.create/transition, supplier.create, template.save, schedule.create, team.invite/update/revoke, notification.read/preferences, settings.save, limits.update, onboarding.save, site.create, account.delete-request, demo.clear.

## 11. Environment Variables

`.env.example` documents every variable and contains no secrets.

| Variables                                                                                                                                       | Source/use                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| APP_URL                                                                                                                                         | Exact canonical HTTP(S) origin; CSRF and billing URLs                                            |
| PROBE_DEMO_ENABLED                                                                                                                              | Explicit local demo opt-in; disable for live service                                             |
| SESSION_SECRET                                                                                                                                  | Generated random 32+ character demo signing secret                                               |
| NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, APP_ID, MESSAGING_SENDER_ID (each with the NEXT_PUBLIC_FIREBASE_ prefix) | Firebase web app configuration                                                                   |
| FIREBASE_PROJECT_ID                                                                                                                             | Server project                                                                                   |
| FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY                                                                                                     | Server service account; prefer application-default/workload identity; escaped newlines supported |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET                                                                                                        | Stripe API/signing secrets                                                                       |
| STRIPE_PRO_PRICE_ID, STRIPE_GROUP_PRICE_ID                                                                                                      | Operator-created recurring prices                                                                |
| EMAIL_FROM, EMAIL_API_KEY                                                                                                                       | Reserved; email adapter not implemented                                                          |
| ERROR_TRACKING_DSN, ANALYTICS_WRITE_KEY                                                                                                         | Reserved; adapters not active                                                                    |
| NEXT_PUBLIC_FIREBASE_VAPID_KEY                                                                                                                  | Reserved; push adapter not active                                                                |

## 12. Setup Instructions

```powershell
npm ci
node scripts/setup-demo.mjs
npm run dev
```

Visit http://localhost:3000/login and choose Explore with demo data. Setup creates `.env.local` only when missing. Alternatively copy `.env.example` and generate a random secret with Node crypto.

For Firebase: create a project, enable Firestore/Auth, register a web app, enable intended providers, authorize domains and populate public/server variables. Deploy firestore.rules, firestore.indexes.json and storage.rules with the Firebase CLI. Use server-only credentials/workload identity. Verified first login provisions the tenant. Test providers and emulator rules before real use.

For Stripe: create Pro/Group recurring prices, configure keys and customer.subscription.created/updated/deleted webhooks. Test retries, ordering, cancellation and downgrade in test mode. Prices are configured by the operator, not hardcoded.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
# App server running, Chrome installed:
npx playwright test
```

The Windows sandbox required elevated tool execution for dependency downloads, HTTP/browser tests and build output creation. A normal Node deployment does not require administrator privileges.

## 13. Demo Credentials / Demo Mode

No password. Seed: Green Table Café/Main Street, four equipment units, three people, seven templates, seven days of readings, twelve daily tasks, an excursion issue, suppliers and notification. `.probe-data/` is ignored. Sessions expire after one day. Remove sample activity clears only the current demo's logs/issues/tasks/notifications/reports/links, retaining sample configuration. A new demo creates another independent workspace. Sample files currently require operator cleanup.

## 14. Security

Server-derived tenants, checked references, central permissions, strict schemas, Origin checks, HttpOnly cookies and deny-all direct Firebase rules form the boundary. No upload endpoint exists, so uploads fail closed. Staff site assignments are enforced on capture. Original entry values and historical versions are preserved.

Inspector tokens are random, hashed, expiring and revocable. CSV formula prefixes are neutralized. React escapes text and JSON-LD escapes less-than signs. Private PDFs/exports are non-cacheable. Stripe signatures and duplicate event IDs are checked. Service credentials stay server-only.

Headers include nosniff, frame denial, referrer policy and restrictive camera/microphone/geolocation permissions. Rate limiting is process-local; a distributed limiter, trusted proxy configuration, CSP, backups, retention and monitoring remain launch requirements.

## 15. Testing

`tests/domain.test.ts` and `tests/security.test.ts`: 52 tests passed at the security milestone, covering roles, tenant references, range/timing validation, automatic issues, capture retry deduplication, amendments, template versions, corrective transitions, link expiry/revocation, plan limits, session tampering, Origin checks, CSV formulas and real PDF generation.

`tests/e2e/workflows.spec.ts`: actual HTTP and Chrome tests for sessions/guards, capture→amend→resolve→report→share→revoke, two-tenant isolation, public downloads, route navigation, dialog Escape behavior, browser exceptions and desktop/tablet/phone overflow.

Final verification on 2026-11-13: lint passed, strict TypeScript passed, **52 unit/security tests passed**, **3 browser/API tests passed**, and the production Webpack build passed. Browser tests ran with an America/New_York timezone distinct from the host, detected no uncaught page exceptions, and verified no page overflow at **1440×1000, 820×1180 and 390×844**. Dashboard screenshots were visually inspected. `npm audit --omit=dev` reports **zero production dependency vulnerabilities** after the gRPC override. `.env.example` contains empty secret fields; `.env.local`, demo data and test artifacts are ignored. Dev-server stream-aborted messages occurred during rapid test navigation; no functional failure or browser exception remained in the passing suite. No performance SLO or full WCAG certification is claimed.

Remaining gaps: live Firebase/Stripe, emulator rules, distributed concurrency/load, all PDF variants, audited WCAG 2.2 AA assessment and mobile/provider dispatch.

## 16. Completed Work

### 2026-11-12

- Inspected empty repository, established stack/design/shared models and auth/tenant architecture.
- Implemented operational capture/correction/report workflow, connected management screens and public surfaces.
- Added provider integration paths and explicit placeholders for unimplemented external services.

### 2026-11-13

- Formatted source and split feature modules.
- Passed 52 domain/security tests, lint and strict TypeScript checks.
- Added targeted historical point reads and bounded client snapshots.
- Verified Webpack production build after host-specific Turbopack failure.
- Added browser/API tests and maintained implementation/deployment documentation.
- Verified cross-timezone hydration, corrected overdue/today calculations, added bounded report metadata projections and patched transitive gRPC.

## 17. Remaining Work

### P0 remaining before production

1. Configure and test Firebase providers, server identity, emulator rules and staging indexes.
2. Complete typed checklist execution, evidence uploads, recurring due-item worker and opening-hours semantics.
3. Send/accept/resend invitations; improve inline onboarding equipment/template/staff selection.
4. Implement MIME-verified/scanned uploads, quota controls and signed URLs.
5. Replace bounded dashboard calculations with date/site aggregates and add server-side filtering/pagination for every growing collection.
6. Add durable large-report jobs and full-history chart queries; branding/font support.
7. Activate tested email/FCM, distributed rate limiting and monitoring.
8. Test Stripe lifecycle and organization-level ordering across multiple subscriptions.
9. Implement retention/deletion cancellation/execution, finalize legal content and deploy.

### P1 future

CSV import previews, complete organization ZIP, inspector passcode, QR labels, company logos, richer delivery evidence, mobile devices/PIN controls, multi-site summaries and localization.

### P2 future

Admin health/feature flags/trial extensions, audited overrides, time-limited read-only impersonation and SMS.

### Technical debt

Replace bounded broad transaction reads with action-specific read sets. Move report evidence to object storage at scale. All displayed record times are explicitly UTC for deterministic hydration; organization-specific timezone presentation remains future work. Local demo locks are process-local.

## 18. Known Issues

- No real provider validation or production deployment yet.
- Dashboard/charts use 100 latest entries. Due-item worker and completion streak are not implemented. Seven-day chart honestly measures successful recorded outcomes, not scheduled compliance.
- Non-log collections use a 250-record server window; more management/history endpoints are required. Entry/report point reads bypass that window.
- Secondary log filters apply to the current page; date filtering is server-side and the UI explains the distinction.
- Synchronous reports reject more than 500 selected entries, 5,000 scanned entries or 800 KB snapshot rather than silently truncate.
- PDF standard fonts replace unsupported characters; multilingual fonts and photo/chart inclusion pending.
- Unit preference is saved but inputs/limits remain explicitly Celsius; Fahrenheit conversion pending.
- Invitations are saved, not delivered. Photo-required definitions cannot yet be executed with attachments.
- Legal/contact pages are explicit drafts. Admin controls beyond search and external workers are absent.
- Dark mode is not persisted; full contrast audit remains.
- Free-plan historical display restriction is relaxed to preserve access; resource-creation limits apply instead.

## 19. Important Developer Notes

Every endpoint requires identity, permission, tenant checks and validation. Never turn off direct Firebase rules to make a mobile client work. Never silently edit original entry values, overwrite historical versions or delete referenced authors. Never silently truncate export/report evidence.

The current site selector is not an authorization boundary: Owner/Manager are organization-wide; Staff capture is assigned-site scoped. Account deletion records a request only. Do not claim data has been deleted.

Firebase Admin requires a Node-compatible host. This source is not a Cloudflare Worker artifact; no Sites publication is claimed. Provider and feature gaps must remain visible in this document until tested end to end.

## 20. How Probe Works End-to-End

Verified owner signs up → server provisions tenant/site/membership → setup progress is saved → managers create equipment/templates → web or future mobile capture posts a validated record → server retains the original and creates an issue for a failure → managers document corrective action and verify high-severity resolutions → reports snapshot selected date/site evidence → owners create expiring links → inspectors read exactly that snapshot without an account.
