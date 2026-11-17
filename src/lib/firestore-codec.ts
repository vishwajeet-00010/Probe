import type { Collection, Entry, Organization } from "@/types/domain";

/**
 * Firestore <-> app-state conversion. Pure (no Firebase imports) so it is unit-testable.
 * The app works with ISO strings; Firestore stores trusted times as Timestamps
 * written with serverTimestamp() (rules require `== request.time`).
 */
type TimestampLike = { toDate(): Date };
const isTimestamp = (v: unknown): v is TimestampLike =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as TimestampLike).toDate === "function";

/** Recursively converts Firestore Timestamps to ISO strings. A pending serverTimestamp reads as null. */
export function toPlain<T>(value: unknown): T {
  if (isTimestamp(value)) return value.toDate().toISOString() as T;
  if (Array.isArray(value)) return value.map((v) => toPlain(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out as T;
  }
  return value as T;
}

export const TRIAL_DAYS = 14;

export function organizationFromDoc(
  data: Record<string, unknown>,
  now = Date.now(),
): Organization {
  const org = toPlain<Organization>(data);
  // A just-created org has a pending serverTimestamp: treat it as "now".
  const created = org.createdAt ?? new Date(now).toISOString();
  return {
    ...org,
    createdAt: created,
    plan: "Free",
    trialEndsAt: new Date(
      Date.parse(created) + TRIAL_DAYS * 86400000,
    ).toISOString(),
  };
}

export function entryFromDoc(data: Record<string, unknown>): Entry {
  const e = toPlain<Entry>(data);
  const server = e.serverTimestamp ?? new Date().toISOString();
  return {
    ...e,
    serverTimestamp: server,
    timingFlag:
      Math.abs(Date.parse(server) - Date.parse(e.deviceTimestamp)) >
      5 * 60 * 1000,
  };
}

/** Fields written as serverTimestamp() (must equal request.time in the rules). */
export const serverTimeFields: Partial<Record<Collection, string[]>> = {
  entries: ["serverTimestamp"],
  issues: ["createdAt"],
  auditEvents: ["at"],
  templateVersions: ["createdAt"],
  reports: ["generatedAt"],
  notifications: ["createdAt"],
  invitations: ["createdAt"],
  dueItems: ["completedAt"],
};

/** Derived, read-only fields that must never be written. */
export const derivedFields: Partial<Record<Collection, string[]>> = {
  entries: ["timingFlag"],
  reports: ["entries", "issues"],
};

export type Write =
  | {
      op: "set";
      collection: Collection;
      id: string;
      data: Record<string, unknown>;
    }
  | {
      op: "update";
      collection: Collection;
      id: string;
      data: Record<string, unknown>;
    }
  | { op: "org"; data: Record<string, unknown> };

const SERVER_TIME = "__SERVER_TIME__";

/**
 * Diffs two app states into the minimal list of Firestore writes: new rows are
 * `set` (with server-time fields marked), changed rows are `update` with only the
 * changed top-level keys (so rules can check affectedKeys()).
 */
export function diffWrites<S extends { organization: object }>(
  before: S,
  after: S,
  collections: Collection[],
  orgServerFields: string[] = ["deletionRequestedAt"],
): Write[] {
  const writes: Write[] = [];
  const orgBefore = before.organization as Record<string, unknown>;
  const orgAfter = after.organization as Record<string, unknown>;
  const orgChanges: Record<string, unknown> = {};
  for (const key of Object.keys(orgAfter))
    if (
      !["plan", "trialEndsAt", "createdAt", "ownerId", "id"].includes(key) &&
      JSON.stringify(orgBefore[key]) !== JSON.stringify(orgAfter[key])
    )
      orgChanges[key] = orgServerFields.includes(key)
        ? SERVER_TIME
        : orgAfter[key];
  if (Object.keys(orgChanges).length)
    writes.push({ op: "org", data: orgChanges });

  for (const collection of collections) {
    const rowsBefore = (before as unknown as Record<string, { id: string }[]>)[
      collection
    ];
    const rowsAfter = (after as unknown as Record<string, { id: string }[]>)[
      collection
    ];
    const old = new Map(rowsBefore.map((r) => [r.id, r]));
    const server = serverTimeFields[collection] ?? [];
    const derived = derivedFields[collection] ?? [];
    for (const row of rowsAfter) {
      const prev = old.get(row.id) as Record<string, unknown> | undefined;
      const next = row as unknown as Record<string, unknown>;
      if (!prev) {
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(next))
          if (!derived.includes(k))
            data[k] = server.includes(k) && v !== null ? SERVER_TIME : v;
        writes.push({ op: "set", collection, id: row.id, data });
        continue;
      }
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(next))
        if (
          !derived.includes(k) &&
          JSON.stringify(prev[k]) !== JSON.stringify(v)
        )
          data[k] = server.includes(k) && v !== null ? SERVER_TIME : v;
      if (Object.keys(data).length)
        writes.push({ op: "update", collection, id: row.id, data });
    }
  }
  return writes;
}

export const isServerTime = (v: unknown) => v === SERVER_TIME;
