import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import type { Actor, Collection, State } from "@/types/domain";
import { firebaseAdmin } from "./firebase/admin";
import { assertTenant, DomainError, tenantRecord } from "./permissions";
import { emptyState } from "./seed";
const collections: Collection[] = [
  "sites",
  "memberships",
  "equipment",
  "entries",
  "issues",
  "templates",
  "templateVersions",
  "schedules",
  "dueItems",
  "suppliers",
  "reports",
  "shareLinks",
  "notifications",
  "auditEvents",
  "subscriptions",
  "notificationPreferences",
];
const root = path.join(process.cwd(), ".probe-data");
const locks = new Map<string, Promise<unknown>>();
function filename(id: string) {
  if (!/^demo-[a-f0-9-]+$/.test(id))
    throw new DomainError("Invalid demo organization.", 403);
  return path.join(root, `${id}.json`);
}
export async function initializeDemo(state: State) {
  await mkdir(root, { recursive: true });
  await writeFile(filename(state.organization.id), JSON.stringify(state), {
    flag: "wx",
  });
}
async function localRead(actor: Actor): Promise<State> {
  try {
    return JSON.parse(
      await readFile(filename(actor.organizationId), "utf8"),
    ) as State;
  } catch {
    throw new DomainError("Demo session expired. Start a new demo.", 401);
  }
}
type RecordRequest = { collection: Collection; id: string };
async function firestoreRead(
  actor: Actor,
  tx?: Transaction,
  requested: RecordRequest[] = [],
): Promise<State> {
  const { db } = firebaseAdmin();
  const ref = db.collection("organizations").doc(actor.organizationId);
  const doc = tx ? await tx.get(ref) : await ref.get();
  if (!doc.exists) throw new DomainError("Organization not found.", 404);
  const state = emptyState(actor.organizationId);
  state.organization = doc.data() as State["organization"];
  await Promise.all(
    collections.map(async (key) => {
      let q = ref
        .collection(key)
        .orderBy(
          key === "entries"
            ? "serverTimestamp"
            : key === "auditEvents"
              ? "at"
              : "id",
          "desc",
        )
        .limit(key === "entries" ? 100 : 250);
      if (key === "reports")
        q = q.select(
          "id",
          "organizationId",
          "name",
          "start",
          "end",
          "siteIds",
          "sections",
          "generatedAt",
          "generatedBy",
          "status",
          "businessName",
          "address",
          "registrationId",
          "watermarked",
        );
      const snap = tx ? await tx.get(q) : await q.get();
      Object.assign(state, {
        [key]: snap.docs.map((d) =>
          key === "reports"
            ? { ...d.data(), entries: [], issues: [] }
            : d.data(),
        ),
      });
    }),
  );
  // Point reads keep old records amendable and retries idempotent beyond the
  // operational page, without loading an organization's entire log history.
  for (const request of requested) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(request.id))
      throw new DomainError("Invalid record identifier.");
    if (
      request.collection !== "reports" &&
      state[request.collection].some((row) => row.id === request.id)
    )
      continue;
    const recordRef = ref.collection(request.collection).doc(request.id);
    const record = tx ? await tx.get(recordRef) : await recordRef.get();
    if (record.exists) {
      const rows = state[request.collection] as {
        id: string;
        organizationId: string;
      }[];
      const data = record.data() as { id: string; organizationId: string };
      assertTenant(actor, data.organizationId);
      const existing = rows.findIndex((row) => row.id === request.id);
      if (existing >= 0) rows[existing] = data;
      else rows.push(data);
    }
  }
  return state;
}
export function clientSnapshot(state: State): State {
  return {
    ...state,
    entries: [...state.entries]
      .sort((a, b) => b.serverTimestamp.localeCompare(a.serverTimestamp))
      .slice(0, 100),
    reports: state.reports
      .slice(0, 100)
      .map((report) => ({ ...report, entries: [], issues: [] })),
    auditEvents: state.auditEvents.slice(0, 250),
  };
}
export async function readRecord<K extends Collection>(
  actor: Actor,
  collection: K,
  id: string,
): Promise<State[K][number]> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new DomainError("Record not found.", 404);
  if (actor.demo)
    return tenantRecord(
      actor,
      (await localRead(actor))[collection] as State[K][number][],
      id,
    );
  const { db } = firebaseAdmin();
  const record = await db
    .collection("organizations")
    .doc(actor.organizationId)
    .collection(collection)
    .doc(id)
    .get();
  if (!record.exists) throw new DomainError("Record not found.", 404);
  const value = record.data() as State[K][number];
  assertTenant(actor, value.organizationId);
  return value;
}
export async function issuesForPeriod(
  actor: Actor,
  start: string,
  end: string,
) {
  if (actor.demo)
    return (await localRead(actor)).issues.filter(
      (i) => i.createdAt >= start && i.createdAt <= end,
    );
  const { db } = firebaseAdmin();
  const result = await db
    .collection("organizations")
    .doc(actor.organizationId)
    .collection("issues")
    .where("createdAt", ">=", start)
    .where("createdAt", "<=", end)
    .limit(501)
    .get();
  if (result.size > 500)
    throw new DomainError(
      "Too many issues for one report. Choose a shorter period.",
      422,
    );
  return result.docs.map((d) => d.data() as State["issues"][number]);
}
export async function readState(actor: Actor) {
  const state = actor.demo
    ? await localRead(actor)
    : await firestoreRead(actor);
  assertTenant(actor, state.organization.id);
  return state;
}
export async function mutate<T>(
  actor: Actor,
  fn: (state: State) => T,
  requested: RecordRequest[] = [],
): Promise<T> {
  if (actor.demo) {
    const previous = locks.get(actor.organizationId) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const state = await localRead(actor);
        assertTenant(actor, state.organization.id);
        const result = fn(state);
        const file = filename(actor.organizationId),
          temp = `${file}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(state));
        await rename(temp, file);
        return result;
      });
    locks.set(actor.organizationId, next);
    try {
      return await next;
    } finally {
      if (locks.get(actor.organizationId) === next)
        locks.delete(actor.organizationId);
    }
  }
  const { db } = firebaseAdmin();
  return db.runTransaction(async (tx) => {
    const state = await firestoreRead(actor, tx, requested);
    assertTenant(actor, state.organization.id);
    const before = structuredClone(state);
    const result = fn(state);
    const ref = db.collection("organizations").doc(actor.organizationId);
    if (
      JSON.stringify(before.organization) !== JSON.stringify(state.organization)
    )
      tx.set(ref, state.organization);
    for (const key of collections) {
      const old = new Map(before[key].map((r) => [r.id, JSON.stringify(r)]));
      for (const row of state[key])
        if (old.get(row.id) !== JSON.stringify(row))
          tx.set(ref.collection(key).doc(row.id), row);
    }
    return result;
  });
}
export async function provisionOrganization(
  uid: string,
  email: string,
  name: string,
) {
  const { db } = firebaseAdmin();
  const user = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(user);
    if (existing.exists) return String(existing.get("organizationId"));
    const id = randomUUID();
    const state = emptyState(id, name, uid, email);
    tx.create(db.collection("organizations").doc(id), state.organization);
    for (const key of ["sites", "memberships"] as const)
      for (const row of state[key])
        tx.create(
          db.collection("organizations").doc(id).collection(key).doc(row.id),
          row,
        );
    tx.create(user, { uid, organizationId: id });
    return id;
  });
}
export async function entriesPage(
  actor: Actor,
  options: {
    cursor?: string;
    start?: string;
    end?: string;
    limit?: number;
  } = {},
) {
  const limit = Math.min(options.limit ?? 50, 100);
  if (actor.demo) {
    const state = await readState(actor);
    let rows = state.entries
      .filter(
        (e) =>
          (!options.start || e.serverTimestamp >= options.start) &&
          (!options.end || e.serverTimestamp <= options.end),
      )
      .sort(
        (a, b) =>
          b.serverTimestamp.localeCompare(a.serverTimestamp) ||
          b.id.localeCompare(a.id),
      );
    if (options.cursor) {
      const i = rows.findIndex((e) => e.id === options.cursor);
      if (i < 0) throw new DomainError("Invalid page cursor.");
      rows = rows.slice(i + 1);
    }
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
  const { db } = firebaseAdmin();
  let q = db
    .collection("organizations")
    .doc(actor.organizationId)
    .collection("entries")
    .orderBy("serverTimestamp", "desc")
    .orderBy("id", "desc");
  if (options.start) q = q.where("serverTimestamp", ">=", options.start);
  if (options.end) q = q.where("serverTimestamp", "<=", options.end);
  if (options.cursor) {
    const cursor = await db
      .collection("organizations")
      .doc(actor.organizationId)
      .collection("entries")
      .doc(options.cursor)
      .get();
    if (!cursor.exists) throw new DomainError("Invalid page cursor.");
    q = q.startAfter(cursor);
  }
  const snap = await q.limit(limit + 1).get();
  const items = snap.docs
    .slice(0, limit)
    .map((d) => d.data() as State["entries"][number]);
  return { items, nextCursor: snap.size > limit ? items.at(-1)!.id : null };
}
