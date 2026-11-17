"use client";
/**
 * Client data layer: the web app talks to Firestore directly (no server).
 * firestore.rules enforce tenancy, roles and record integrity; the checks here
 * exist for fast, friendly errors. Schema: docs/FIREBASE_SCHEMA.md.
 */
import type { User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  endAt,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  startAt,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from "firebase/firestore";
import { clientDb } from "./firebase/client";
import {
  diffWrites,
  entryFromDoc,
  isServerTime,
  organizationFromDoc,
  toPlain,
} from "./firestore-codec";
import { commandSchema, reportSchema } from "./validation";
import { applyCommand } from "@/services/commands";
import { authorize, DomainError, tenantRecord } from "./permissions";
import { effectivePlan } from "./domain";
import { emptyState } from "./seed";
import { entriesCsv, reportPdf } from "./reports";
import type {
  Actor,
  Collection,
  Entry,
  Invitation,
  Issue,
  Report,
  ShareLink,
  State,
} from "@/types/domain";

const orgRef = (orgId: string) => doc(clientDb(), "organizations", orgId);
const col = (orgId: string, name: string) => collection(orgRef(orgId), name);
const uuid = () => crypto.randomUUID();

// ---------------------------------------------------------------- session

export type Session =
  | { status: "unverified"; user: User }
  | { status: "no-organization"; user: User; invitations: Invitation[] }
  | { status: "inactive"; user: User }
  | { status: "ready"; user: User; actor: Actor };

export async function resolveSession(user: User): Promise<Session> {
  if (!user.emailVerified) return { status: "unverified", user };
  const db = clientDb();
  const token = await user.getIdTokenResult();
  const profile = await getDoc(doc(db, "users", user.uid));
  if (!profile.exists())
    return {
      status: "no-organization",
      user,
      invitations: await pendingInvitations(user),
    };
  const organizationId = String(profile.get("organizationId"));
  const member = await getDoc(
    doc(db, "organizations", organizationId, "memberships", user.uid),
  );
  if (!member.exists() || member.get("status") !== "Active")
    return { status: "inactive", user };
  return {
    status: "ready",
    user,
    actor: {
      uid: user.uid,
      organizationId,
      name: String(member.get("name")),
      email: String(member.get("email")),
      role: member.get("role"),
      admin: token.claims.internalAdmin === true,
    },
  };
}

const emailOf = (user: User) => (user.email ?? "").toLowerCase();

export async function pendingInvitations(user: User) {
  const snap = await getDocs(
    query(
      collectionGroup(clientDb(), "invitations"),
      where("email", "==", emailOf(user)),
    ),
  );
  return snap.docs
    .map((d) => toPlain<Invitation>(d.data()))
    .filter((i) => i.status === "Invited");
}

/** Recipe 1: verified owner creates a new organization in one batch. */
export async function createOrganization(user: User, businessName: string) {
  const name = businessName.trim().slice(0, 200);
  if (!name) throw new Error("Enter your business name.");
  const organizationId = uuid();
  const email = emailOf(user);
  const batch = writeBatch(clientDb());
  batch.set(orgRef(organizationId), {
    id: organizationId,
    name,
    address: "",
    registrationId: "",
    region: "United Kingdom",
    units: "C",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
    onboardingStep: 0,
    onboarding: {},
    plan: "Free",
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(col(organizationId, "memberships"), user.uid), {
    id: user.uid,
    organizationId,
    userId: user.uid,
    name: user.displayName?.trim() || email.split("@")[0] || "Owner",
    email,
    role: "Owner",
    siteIds: ["main"],
    status: "Active",
    lastActive: new Date().toISOString(),
  });
  batch.set(doc(col(organizationId, "sites"), "main"), {
    id: "main",
    organizationId,
    name: "Main site",
    address: "",
  });
  batch.set(doc(clientDb(), "users", user.uid), {
    uid: user.uid,
    organizationId,
    email,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
}

/** Recipe 2: accept an invitation addressed to this verified email. */
export async function acceptInvitation(user: User, invitation: Invitation) {
  const email = emailOf(user);
  const batch = writeBatch(clientDb());
  batch.set(doc(col(invitation.organizationId, "memberships"), user.uid), {
    id: user.uid,
    organizationId: invitation.organizationId,
    userId: user.uid,
    name: invitation.name,
    email,
    role: invitation.role,
    siteIds: invitation.siteIds,
    status: "Active",
    lastActive: new Date().toISOString(),
  });
  batch.update(doc(col(invitation.organizationId, "invitations"), email), {
    status: "Accepted",
    acceptedBy: user.uid,
  });
  batch.set(doc(clientDb(), "users", user.uid), {
    uid: user.uid,
    organizationId: invitation.organizationId,
    email,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
}

// ---------------------------------------------------------------- live state

/** Collections diffed into writes by commands (shareLinks live in sharedReports). */
const writable: Collection[] = [
  "sites",
  "memberships",
  "invitations",
  "equipment",
  "entries",
  "issues",
  "templates",
  "templateVersions",
  "schedules",
  "dueItems",
  "suppliers",
  "reports",
  "notifications",
  "auditEvents",
  "notificationPreferences",
];

/**
 * Subscribes to the bounded operational view of an organization. Windows are
 * ordered by real time fields, so the newest records are always included.
 */
export function subscribeState(
  actor: Actor,
  onState: (state: State) => void,
  onError: (error: Error) => void,
) {
  const o = actor.organizationId;
  const listQueries: [Collection, Query][] = [
    ["sites", query(col(o, "sites"), limit(250))],
    ["memberships", query(col(o, "memberships"), limit(250))],
    [
      "invitations",
      query(col(o, "invitations"), orderBy("createdAt", "desc"), limit(250)),
    ],
    ["equipment", query(col(o, "equipment"), limit(250))],
    [
      "entries",
      query(col(o, "entries"), orderBy("serverTimestamp", "desc"), limit(100)),
    ],
    [
      "issues",
      query(col(o, "issues"), orderBy("createdAt", "desc"), limit(250)),
    ],
    ["templates", query(col(o, "templates"), limit(250))],
    [
      "templateVersions",
      query(
        col(o, "templateVersions"),
        orderBy("createdAt", "desc"),
        limit(250),
      ),
    ],
    ["schedules", query(col(o, "schedules"), limit(250))],
    [
      "dueItems",
      query(col(o, "dueItems"), orderBy("dueAt", "desc"), limit(250)),
    ],
    ["suppliers", query(col(o, "suppliers"), limit(250))],
    [
      "reports",
      query(col(o, "reports"), orderBy("generatedAt", "desc"), limit(100)),
    ],
    [
      "notifications",
      query(col(o, "notifications"), orderBy("createdAt", "desc"), limit(100)),
    ],
    [
      "auditEvents",
      query(col(o, "auditEvents"), orderBy("at", "desc"), limit(250)),
    ],
  ];
  if (actor.role === "Owner")
    listQueries.push([
      "shareLinks",
      query(
        collection(clientDb(), "sharedReports"),
        where("organizationId", "==", o),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
    ]);

  const state = emptyState(o);
  state.sites = [];
  state.memberships = [];
  const pending = new Set<string>([
    "organization",
    "notificationPreferences",
    ...listQueries.map(([k]) => k),
  ]);
  const emit = (key: string) => {
    pending.delete(key);
    if (!pending.size) onState(structuredClone(state));
  };
  const fail = (e: Error) => onError(e);

  const mapRow = (key: Collection, data: DocumentData) => {
    if (key === "entries") return entryFromDoc(data);
    if (key === "reports")
      return { ...toPlain<Report>(data), entries: [], issues: [] };
    if (key === "shareLinks") {
      const link: DocumentData = { ...data };
      delete link.report; // the evidence copy is only needed by inspectors
      delete link.createdBy;
      return toPlain<ShareLink>(link);
    }
    return toPlain(data);
  };

  const unsubscribers = [
    onSnapshot(
      orgRef(o),
      (snap) => {
        if (!snap.exists()) return fail(new Error("Organization not found."));
        state.organization = organizationFromDoc(snap.data());
        emit("organization");
      },
      fail,
    ),
    onSnapshot(
      doc(col(o, "notificationPreferences"), actor.uid),
      (snap) => {
        state.notificationPreferences = snap.exists()
          ? [toPlain(snap.data())]
          : [];
        emit("notificationPreferences");
      },
      fail,
    ),
    ...listQueries.map(([key, q]) =>
      onSnapshot(
        q,
        (snap) => {
          Object.assign(state, {
            [key]: snap.docs.map((d) => mapRow(key, d.data())),
          });
          emit(key);
        },
        fail,
      ),
    ),
  ];
  return () => unsubscribers.forEach((u) => u());
}

// ---------------------------------------------------------------- commands

function materialize(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data))
    out[k] = isServerTime(v) ? serverTimestamp() : v;
  return out;
}

/** Applies a domain command to a copy of the state and commits the diff atomically. */
export async function executeCommand(
  actor: Actor,
  state: State,
  input: unknown,
) {
  const command = commandSchema.parse(input);
  const after = structuredClone(state);
  const result = applyCommand(after, actor, command);
  const writes = diffWrites(state, after, writable);
  if (!writes.length) return result;
  const batch = writeBatch(clientDb());
  for (const w of writes) {
    const data = materialize(w.data);
    if (w.op === "org") batch.update(orgRef(actor.organizationId), data);
    else if (w.op === "set")
      batch.set(doc(col(actor.organizationId, w.collection), w.id), data);
    else batch.update(doc(col(actor.organizationId, w.collection), w.id), data);
  }
  await batch.commit();
  return result;
}

function auditDoc(
  actor: Actor,
  action: string,
  entity: string,
  value: unknown,
) {
  const id = uuid();
  return [
    doc(col(actor.organizationId, "auditEvents"), id),
    {
      id,
      organizationId: actor.organizationId,
      actor: actor.name,
      actorId: actor.uid,
      at: serverTimestamp(),
      action,
      entity,
      oldValue: "null",
      newValue: JSON.stringify(value),
      metadata: {},
    },
  ] as const;
}

// ---------------------------------------------------------------- logs

export async function entriesPage(
  actor: Actor,
  options: {
    cursor?: string | null;
    start?: string;
    end?: string;
    limit?: number;
  } = {},
) {
  const size = Math.min(options.limit ?? 50, 100);
  const entries = col(actor.organizationId, "entries");
  let q = query(entries, orderBy("serverTimestamp", "desc"));
  if (options.start)
    q = query(
      q,
      where(
        "serverTimestamp",
        ">=",
        Timestamp.fromDate(new Date(options.start)),
      ),
    );
  if (options.end)
    q = query(
      q,
      where("serverTimestamp", "<=", Timestamp.fromDate(new Date(options.end))),
    );
  if (options.cursor) {
    const cursor = await getDoc(doc(entries, options.cursor));
    if (!cursor.exists()) throw new DomainError("Invalid page cursor.");
    q = query(q, startAfter(cursor));
  }
  const snap = await getDocs(query(q, limit(size + 1)));
  const items = snap.docs.slice(0, size).map((d) => entryFromDoc(d.data()));
  return { items, nextCursor: snap.size > size ? items.at(-1)!.id : null };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Full-history CSV, paged in the browser (reads every entry once). */
export async function exportEntriesCsv(actor: Actor) {
  authorize(actor, "reports");
  const all: Entry[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: Entry[]; nextCursor: string | null } =
      await entriesPage(actor, { cursor, limit: 100 });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  download(
    new Blob(["﻿" + entriesCsv(all)], { type: "text/csv;charset=utf-8" }),
    "probe-all-records.csv",
  );
}

// ---------------------------------------------------------------- reports

const sectionForType: Record<string, string> = {
  Temperature: "Temperature records",
  Checklist: "Checklist completion",
  Delivery: "Deliveries",
  Cleaning: "Cleaning records",
  "Corrective action": "Corrective actions",
};

/** Recipe 4: snapshot selected evidence into an immutable report. */
export async function generateReport(
  actor: Actor,
  state: State,
  input: {
    name: string;
    start: string;
    end: string;
    siteIds: string[];
    sections: string[];
  },
) {
  authorize(actor, "reports");
  const r = reportSchema.parse(input);
  for (const id of r.siteIds) tenantRecord(actor, state.sites, id);
  const start = `${r.start}T00:00:00.000Z`,
    end = `${r.end}T23:59:59.999Z`;
  const entries: Entry[] = [];
  let scanned = 0;
  let cursor: string | null = null;
  do {
    const page: { items: Entry[]; nextCursor: string | null } =
      await entriesPage(actor, { start, end, cursor, limit: 100 });
    entries.push(...page.items.filter((e) => r.siteIds.includes(e.siteId)));
    scanned += page.items.length;
    if (scanned > 5000 || entries.length > 500)
      throw new DomainError(
        "Reports support up to 500 records. Choose a shorter period.",
        422,
      );
    cursor = page.nextCursor;
  } while (cursor);
  const included = new Set<string>(r.sections);
  let issues: Issue[] = [];
  if (included.has("Corrective actions")) {
    const snap = await getDocs(
      query(
        col(actor.organizationId, "issues"),
        where("createdAt", ">=", Timestamp.fromDate(new Date(start))),
        where("createdAt", "<=", Timestamp.fromDate(new Date(end))),
        limit(501),
      ),
    );
    if (snap.size > 500)
      throw new DomainError(
        "Too many issues for one report. Choose a shorter period.",
        422,
      );
    issues = snap.docs
      .map((d) => toPlain<Issue>(d.data()))
      .filter((i) => r.siteIds.includes(i.siteId));
  }
  const id = uuid();
  const selected = entries.filter((e) => included.has(sectionForType[e.type]));
  const meta = {
    id,
    organizationId: actor.organizationId,
    name: r.name,
    start: r.start,
    end: r.end,
    siteIds: r.siteIds,
    sections: r.sections,
    generatedBy: actor.name,
    generatedById: actor.uid,
    status: "Ready" as const,
    businessName: state.organization.name,
    address: state.organization.address,
    registrationId: state.organization.registrationId,
    watermarked: effectivePlan(state) === "Free",
    entryCount: selected.length,
    issueCount: issues.length,
  };
  const snapshot = {
    id,
    organizationId: actor.organizationId,
    entries: selected,
    issues,
  };
  if (new Blob([JSON.stringify(snapshot)]).size > 800000)
    throw new DomainError(
      "Report is too large. Select a shorter date range.",
      422,
    );
  const batch = writeBatch(clientDb());
  batch.set(doc(col(actor.organizationId, "reports"), id), {
    ...meta,
    generatedAt: serverTimestamp(),
  });
  batch.set(doc(col(actor.organizationId, "reportSnapshots"), id), snapshot);
  batch.set(
    ...auditDoc(actor, "report.generated", id, { start: r.start, end: r.end }),
  );
  await batch.commit();
  return id;
}

export async function loadReport(actor: Actor, id: string): Promise<Report> {
  authorize(actor, "reports");
  const [meta, snapshot] = await Promise.all([
    getDoc(doc(col(actor.organizationId, "reports"), id)),
    getDoc(doc(col(actor.organizationId, "reportSnapshots"), id)),
  ]);
  if (!meta.exists() || !snapshot.exists())
    throw new DomainError("Report not found.", 404);
  const s = toPlain<{ entries: Entry[]; issues: Issue[] }>(snapshot.data());
  return {
    ...toPlain<Report>(meta.data()),
    entries: s.entries,
    issues: s.issues,
  };
}

export async function downloadReportPdf(actor: Actor, id: string) {
  const report = await loadReport(actor, id);
  const bytes = await reportPdf(report);
  download(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    `probe-${id}.pdf`,
  );
}

// ---------------------------------------------------------------- inspector links

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createShare(
  actor: Actor,
  state: State,
  reportId: string,
  days: 1 | 7 | 30,
) {
  authorize(actor, "share");
  if (effectivePlan(state) === "Free")
    throw new DomainError(
      "Share links require Pro. Your reports and exports remain available.",
      403,
    );
  const report = await loadReport(actor, reportId);
  const token = randomToken();
  const batch = writeBatch(clientDb());
  batch.set(doc(clientDb(), "sharedReports", token), {
    id: token,
    organizationId: actor.organizationId,
    reportId,
    report,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + days * 86400000),
    revoked: false,
    accesses: 0,
    lastAccessAt: null,
    createdBy: actor.uid,
  });
  batch.set(...auditDoc(actor, "share.created", reportId, { days }));
  await batch.commit();
  return `${window.location.origin}/inspect#${token}`;
}

export async function revokeShare(actor: Actor, token: string) {
  authorize(actor, "share");
  const batch = writeBatch(clientDb());
  batch.update(doc(clientDb(), "sharedReports", token), { revoked: true });
  batch.set(...auditDoc(actor, "share.revoked", token.slice(0, 8), true));
  await batch.commit();
}

/** Public: no sign-in. The rules only return a valid, unrevoked link. */
export async function inspectReport(token: string): Promise<Report | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const ref = doc(clientDb(), "sharedReports", token);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    updateDoc(ref, {
      accesses: increment(1),
      lastAccessAt: serverTimestamp(),
    }).catch(() => {});
    return toPlain<Report>(snap.get("report"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- internal admin

export async function searchOrganizations(prefix: string) {
  const snap = await getDocs(
    query(
      collection(clientDb(), "organizations"),
      orderBy("name"),
      startAt(prefix),
      endAt(`${prefix}`),
      limit(25),
    ),
  );
  return snap.docs.map((d) => organizationFromDoc(d.data()));
}
