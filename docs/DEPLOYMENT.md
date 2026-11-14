# Deployment and activation

Requires Node 22+. This is not a static export or Cloudflare Worker artifact. No deployment has been performed.

1. Create an operator-owned Firebase project, enable intended Auth providers and Firestore, and authorize domains.
2. Supply public Firebase web configuration at build time. Supply Admin credentials through workload identity or a secret manager. Never use NEXT_PUBLIC for service-account credentials.
3. Deploy provided deny-by-default Firestore/Storage rules and indexes. Test via emulators; current clients use the server API.
4. Set APP_URL to the exact HTTPS origin; disable PROBE_DEMO_ENABLED for real data. Demo file storage is not suitable for serverless/multiple instances.
5. Configure Stripe test-mode prices and subscription webhooks; verify checkout, portal, retries, ordering, cancellations and exports.
6. Complete the P0 list in PROJECT_IMPLEMENTATION.md, especially checklist execution, scheduling, invites, evidence upload and workers.
7. Run lint, types, unit/security tests, production build and browser/API tests against staging. Measure performance and audit keyboard/focus/contrast.
8. Add distributed rate limits, trusted proxy configuration, CSP, observability, backups, retention and operator-approved legal content.

Extend synchronous reports with durable jobs/object storage rather than unbounded browser or server memory. Admin access requires trusted internalAdmin claims and active membership. Impersonation remains disabled.
