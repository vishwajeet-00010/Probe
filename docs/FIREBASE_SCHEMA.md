# Probe Firestore schema (shared by web + Flutter)

Probe has **no application server**. The Next.js web app (static export on Firebase
Hosting) and the Flutter app both talk to Firebase Auth + Cloud Firestore directly.
`firestore.rules` is the security boundary; this document is the contract both
clients follow. If a write does not match a recipe below, the rules reject it.

Firebase plan: **Spark (free)**. No Cloud Functions, no Cloud Storage, no Admin SDK at
runtime. Billing is RevenueCat (client SDKs), see the bottom of this file.

## Conventions

- **Every field listed for a document is required on create** (use `''`, `[]`, `null`
  or `false` for empty). Rules use `keys().hasOnly([...])` plus type checks, so
  extra fields are rejected and missing fields fail type checks.
- IDs are client-generated UUID v4 strings unless stated otherwise.
- `TS` = Firestore `Timestamp` written with **`FieldValue.serverTimestamp()`**
  (rules require `== request.time`). Clients convert to ISO-8601 strings / `DateTime`
  when reading. Everything else that looks like a time is an ISO-8601 **string**.
- Updates use `update()` with only the changed fields (rules check
  `diff().affectedKeys()`). Never `set()` a whole existing document.
- Email verification is required for every tenant read/write
  (`request.auth.token.email_verified == true`). Google/Apple logins are verified.
- Roles: `Owner` (everything), `Manager` (operations, can manage Staff),
  `Staff` (capture at assigned `siteIds` only).

## Collections

### `users/{uid}`

`{ uid, organizationId, email (lower-case, must equal auth email), createdAt: ISO string }`
Read by its own user. Created during signup or invite acceptance.

### `organizations/{orgId}`

`{ id, name, address, registrationId, region, units: 'C'|'F', timezone, onboardingStep: int 0–10, onboarding: map<string,string>, plan: 'Free', ownerId, createdAt: TS }`
Optional later field: `deletionRequestedAt: TS` (Owner only).

- `plan` stays `'Free'`; paid status comes from RevenueCat. **Trial = `createdAt + 14 days`** (Pro features during trial).
- Owner may update: `name, address, registrationId, region, units, timezone, onboardingStep, onboarding, deletionRequestedAt`.

### `organizations/{orgId}/memberships/{uid}` (doc ID = Firebase Auth uid)

`{ id: uid, organizationId, userId: uid, name, email, role, siteIds: string[], status: 'Active'|'Inactive', lastActive: ISO string }`

- Read: yourself, or Owner/Manager.
- Self may update `name, lastActive`. Owner manages Managers/Staff (`role, status, siteIds, name`), never Owners. Manager manages Staff only (`status, siteIds`).

### `organizations/{orgId}/invitations/{emailLowercase}`

`{ id: email, organizationId, email, name, role: 'Manager'|'Staff', siteIds: string[] (≥1), status: 'Invited'|'Revoked'|'Accepted', invitedBy: uid, createdAt: TS, acceptedBy?: uid }`

- Create by Owner (any role) or Manager (Staff only). Revoke: `status: 'Revoked'`.
- Invitee finds invites with a **collection-group** query:
  `collectionGroup('invitations').where('email', '==', myEmailLowercase)` and filters `status == 'Invited'` client-side.
- **No email is sent** (no server). The inviter tells the person to sign up with that email; the app shows pending invites after sign-in.

### `organizations/{orgId}/sites/{siteId}`

`{ id, organizationId, name, address }` — Owner writes. The signup batch creates `main`.

### `organizations/{orgId}/equipment/{id}`

`{ id, organizationId, name, type, location, siteId, min: number, max: number, frequency, archived: bool }`

- `type` ∈ `Fridge, Freezer, Hot Hold, Display Chiller, Cooking Core, Delivery`. Celsius. `min < max`, range −100..300.
- Manager+ create/update; **changing `min`/`max` is Owner-only** (write an audit event `limits.update` with a reason).

### `organizations/{orgId}/entries/{entryId}` (immutable record)

```
{ id, organizationId, siteId, equipmentId ('' if none), templateVersionId (''), supplierId (''),
  dueItemId (''), type, label, value, numericValue (number for Temperature, else null),
  status, staff (display name), actorId (= auth uid), serverTimestamp: TS,
  deviceTimestamp (ISO string from the device clock), notes, amendments: [], attachmentIds: [],
  issueId (null when status == 'Done', else the issue id created in the same batch) }
```

- `type` ∈ `Temperature, Checklist, Delivery, Cleaning, Corrective action`.
- `status` ∈ `Done, Out of range, Failed, Rejected`. Rules enforce, for Temperature with
  equipment: value outside `[min,max]` ⇒ `'Out of range'`; inside ⇒ `'Done'` or `'Failed'`.
  Failed/Rejected require `notes` ≥ 3 chars. Non-Done ⇒ an issue in the same batch.
- Temperature `value` is the display string, e.g. `"3.2 °C"`.
- Staff may only create at `siteId ∈ membership.siteIds`, and must query with
  `where('siteId', '==', siteId).orderBy('serverTimestamp', 'desc')`.
- "Suspicious timing" is **derived when reading**: `|serverTimestamp − deviceTimestamp| > 5 min` (not stored).
- **Amend** (Owner/Manager): `update({ amendments: [...old, { id, actor, actorId, at: ISO, reason (≥3), value }] })`. Nothing else may change.

### `organizations/{orgId}/issues/{issueId}`

```
{ id, organizationId, title, severity: 'Low'|'Medium'|'High', sourceEntryId (''), equipmentId (''),
  siteId, assignee, dueAt: ISO string, createdAt: TS, status: 'Open',
  timeline: [{ at: ISO, actor: name, actorId: uid, note (≥3), status: 'Open' }] }
```

- Auto-issue for a failed entry: title `"<label>: <status lower-case>"`, severity `High` for Out of range else `Medium`.
- Transition = `update({ status, timeline: [...old, { at, actor, actorId, note, status }] })`.
  Allowed: Open→In Progress|Resolved, In Progress→Resolved, Resolved→Verified (**Manager+ only**).
  Staff may progress/resolve issues at their sites.

### `organizations/{orgId}/templates/{id}` and `templateVersions/{id}`

- template `{ id, organizationId, name, category, currentVersionId, archived }`
- version (immutable) `{ id, organizationId, templateId, version: int, name, category, tasks: Task[], createdAt: TS }`
- `Task = { id, label, type: 'Checkbox'|'Temperature'|'Number'|'Text'|'Required photo'|'Yes/No', required: bool, section, correctivePrompt }`
- Saving = one batch: create a new version (`version = max + 1`) and set the template's `currentVersionId`.

### `schedules/{id}`, `dueItems/{id}`

- schedule `{ id, organizationId, templateId, siteId, cadence: 'daily'|'per shift'|'weekly'|'monthly'|'custom', time: 'HH:MM', assignedTo }`
- dueItem `{ id, organizationId, title, siteId, equipmentId, templateVersionId, dueAt: ISO, assignedTo, status: 'Due'|'Overdue'|'Skipped'|'N/A'|'Done', completedAt: TS|null }`
- Completing: `update({ status: 'Done', completedAt: serverTimestamp })` — allowed for anyone at the site.

### `suppliers/{id}`

`{ id, organizationId, name, email, phone, categories, notes }` — Manager+ write, all members read.
Deliveries are entries with `type: 'Delivery'`, `supplierId`, status `Done`/`Rejected`.

### `reports/{id}` + `reportSnapshots/{id}` (immutable, Owner/Manager)

- report `{ id, organizationId, name, start: 'YYYY-MM-DD', end, siteIds, sections, generatedAt: TS, generatedBy: name, generatedById: uid, status: 'Ready', businessName, address, registrationId, watermarked: bool, entryCount, issueCount }`
- snapshot (same id) `{ id, organizationId, entries: Entry[], issues: Issue[] }` with all timestamps converted to ISO strings. Keep under ~800 KB (Firestore limit is 1 MiB); max 500 entries.
- Both docs are written in **one batch**. PDFs are generated on the device from the snapshot.

### `notifications/{id}`

`{ id, organizationId, title, body, type, createdAt: TS, readBy: [], href }` — mark read with `update({ readBy: arrayUnion(uid) })`.

### `notificationPreferences/{uid}`

`{ id: uid, organizationId, userId: uid, email: bool, push: bool, quietStart: 'HH:MM', quietEnd: 'HH:MM' }` — own doc only. Stored only; nothing is dispatched (no server).

### `auditEvents/{id}` (append-only, Manager+ read)

`{ id, organizationId, actor: name, actorId: uid, at: TS, action, entity, oldValue: JSON string, newValue: JSON string, metadata: {} }`
Write one in the same batch as every meaningful mutation (action names: `equipment.create`, `entry.create`, `entry.amend`, `issue.transition`, `limits.update`, `team.invite`, …).

### `sharedReports/{token}` (top level, public read-by-token)

`{ id: token, organizationId, reportId, report: { ...report metadata (ISO times), entries, issues }, createdAt: TS, expiresAt: Timestamp (≤ 31 days ahead), revoked: false, accesses: 0, lastAccessAt: null, createdBy: uid }`

- `token` = 32 random bytes, base64url (43 chars). The doc ID **is** the secret.
- Anyone with the token may `get` while not revoked/expired and may bump `accesses` by 1 with `lastAccessAt: serverTimestamp`.
- Owner lists links with `where('organizationId','==',orgId).orderBy('createdAt','desc')`, revokes with `update({ revoked: true })`.
- Web inspector URL: `https://<host>/inspect#<token>` (hash keeps the token out of logs).

## Write recipes (single batched write each)

1. **Owner signup** (after email is verified): `organizations/{newId}` + `memberships/{uid}` (role Owner, siteIds `['main']`) + `sites/main` + `users/{uid}`.
2. **Accept invite**: `memberships/{uid}` (role/siteIds copied from invite, status Active) + `invitations/{email}` → `{status:'Accepted', acceptedBy: uid}` + `users/{uid}` (set; replaces an older organization).
3. **Capture entry**: `entries/{id}` + (if not Done) `issues/{issueId}` + `notifications/{id}` + (if `dueItemId`) dueItem → Done + `auditEvents/{id}`.
4. **Generate report**: `reports/{id}` + `reportSnapshots/{id}` + audit event.

Offline (Flutter): Firestore's local cache queues these batches and syncs later; rules run at sync time.

## RevenueCat (billing without a server)

- One RevenueCat project, apps: iOS, Android, **Web Billing**.
- `appUserID` **= organizationId** in every client, so one Owner purchase unlocks the whole team.
- Entitlements: `pro`, `group`. Effective plan: trial active ⇒ Pro; else `group` ⇒ Group; else `pro` ⇒ Pro; else Free.
- Free limits (client-enforced): 1 site, 3 active equipment, 2 active members + pending invites; share links require Pro; free reports are watermarked.
- Rules cannot see RevenueCat. To enforce plans server-side later, move to Blaze and install the
  RevenueCat Firebase extension (writes entitlements to Firestore / custom claims), then add rule checks.

## Internal admin

`internalAdmin: true` custom claim (set with `scripts/set-admin.mjs`, run locally by an operator)
allows listing `organizations` metadata only.
