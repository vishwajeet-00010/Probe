# Changelog

## 0.2.0 — 2026-11-17 (Firebase-only)

- Removed the Next.js server: all API routes, server sessions, Firebase Admin, Stripe and the
  file-based demo. The site is now a static export for Firebase Hosting (free Spark plan).
- Browser talks to Firestore directly; `firestore.rules` now enforces tenancy, roles, Staff site
  scope, immutable entries with append-only amendments, out-of-range ⇒ issue integrity, issue
  transitions, append-only audit log and expiring/revocable inspector links.
- Shared schema for web and the Flutter app in `docs/FIREBASE_SCHEMA.md`.
- Signup creates the organization in one atomic batch; invitations are matched to the invitee's
  verified email (no email is sent).
- Real-time Firestore listeners replace `/api/state`; windows are ordered by time, fixing the old
  random-250 window for issues, notifications, reports and template versions.
- Reports, PDFs, CSV export and the free printable generator are generated in the browser.
- Inspector links moved to `/inspect#token` (token never reaches server logs).
- Billing via RevenueCat Web Billing (`appUserId = organizationId`, entitlements `pro`/`group`).

## 0.1.0 — 2026-11-13

- Established Next.js/React/TypeScript application with green design tokens, responsive navigation, dark mode, dialogs and forms.
- Added independent persistent demo organizations and realistic Green Table Café records.
- Implemented tenant permissions, immutable entries, amendments, automatic excursion issues and manager verification.
- Added equipment, versioned template builder, suppliers/team records, settings, notifications and audit history.
- Implemented inspection snapshots, real server PDFs, full record CSV and expiring/revocable inspector links.
- Added Firebase/Firestore and Stripe integration paths; provider activation remains outstanding.
- Added public website, SEO templates, free printable generator and protected admin metadata search.
- Added 52 domain/security tests and a browser/API workflow suite.
- Fixed old-record point access beyond the operational window and split feature modules.
- Verified Webpack production build after a Windows Turbopack worker failure.
- Documented partial integrations and launch gaps explicitly.
- Fixed locale/timezone hydration errors and a Tailwind ring class collision; verified layout at 1440, 820 and 390 pixels.
- Patched Firebase's transitive gRPC dependency to 1.14.7; production dependency audit is clean.
