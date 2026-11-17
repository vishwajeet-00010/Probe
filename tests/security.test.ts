import { describe, it, expect } from "vitest";
import { csvCell, reportPdf } from "@/lib/reports";
import { printableLogPdf } from "@/lib/printable";
import {
  diffWrites,
  entryFromDoc,
  isServerTime,
  organizationFromDoc,
  toPlain,
} from "@/lib/firestore-codec";
import { applyCommand } from "@/services/commands";
import { seedState } from "@/lib/seed";
import type { Actor, Collection, Report } from "@/types/domain";

const owner: Actor = {
  uid: "demo-owner",
  organizationId: "org-a",
  name: "Alex",
  email: "alex@example.test",
  role: "Owner",
  admin: false,
};
const manager: Actor = { ...owner, role: "Manager" };
const all: Collection[] = [
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
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe("Firestore codec", () => {
  it("converts nested Timestamps to ISO strings", () =>
    expect(
      toPlain({
        a: ts("2026-01-02T03:04:05.000Z"),
        b: [{ c: ts("2026-01-01T00:00:00.000Z") }],
      }),
    ).toEqual({
      a: "2026-01-02T03:04:05.000Z",
      b: [{ c: "2026-01-01T00:00:00.000Z" }],
    }));
  it("derives the 14-day trial from createdAt and never trusts a stored plan", () => {
    const org = organizationFromDoc({
      id: "o",
      createdAt: ts("2026-01-01T00:00:00.000Z"),
      plan: "Group",
    });
    expect(org.trialEndsAt).toBe("2026-01-15T00:00:00.000Z");
    expect(org.plan).toBe("Free");
  });
  it("derives the suspicious-timing flag on read", () => {
    const base = { deviceTimestamp: "2026-01-01T00:00:00.000Z" };
    expect(
      entryFromDoc({ ...base, serverTimestamp: ts("2026-01-01T00:05:00.000Z") })
        .timingFlag,
    ).toBe(false);
    expect(
      entryFromDoc({ ...base, serverTimestamp: ts("2026-01-01T00:05:01.000Z") })
        .timingFlag,
    ).toBe(true);
  });
});

describe("command diff to Firestore writes", () => {
  it("creates an excursion entry, issue, notification and audit with server times", () => {
    const before = seedState("org-a");
    const after = structuredClone(before);
    applyCommand(after, owner, {
      action: "entry.create",
      id: crypto.randomUUID(),
      siteId: "main",
      equipmentId: "walk-in",
      type: "Temperature",
      value: "9",
      notes: "",
      deviceTimestamp: new Date().toISOString(),
      failed: false,
    });
    const writes = diffWrites(before, after, all);
    expect(
      writes
        .map((w) => (w.op === "org" ? "org" : `${w.op}:${w.collection}`))
        .sort(),
    ).toEqual([
      "set:auditEvents",
      "set:entries",
      "set:issues",
      "set:notifications",
    ]);
    const entry = writes.find(
      (w) => w.op === "set" && w.collection === "entries",
    )!;
    expect(isServerTime(entry.data.serverTimestamp)).toBe(true);
    expect("timingFlag" in entry.data).toBe(false);
    const audit = writes.find(
      (w) => w.op === "set" && w.collection === "auditEvents",
    )!;
    expect(isServerTime(audit.data.at)).toBe(true);
  });
  it("updates only the amendments of an existing entry", () => {
    const before = seedState("org-a");
    const after = structuredClone(before);
    applyCommand(after, manager, {
      action: "entry.amend",
      id: before.entries[0].id,
      value: "3.4 °C",
      reason: "Checked against device display.",
    });
    const update = diffWrites(before, after, all).find(
      (w) => w.op === "update",
    )!;
    expect(update).toMatchObject({ collection: "entries" });
    expect(Object.keys(update.data)).toEqual(["amendments"]);
  });
  it("updates only changed organization fields and never the plan", () => {
    const before = seedState("org-a");
    const after = structuredClone(before);
    after.organization.plan = "Group";
    applyCommand(after, owner, {
      action: "account.delete-request",
      confirmation: "DELETE",
    });
    const org = diffWrites(before, after, all).find((w) => w.op === "org")!;
    expect(Object.keys(org.data)).toEqual(["deletionRequestedAt"]);
    expect(isServerTime(org.data.deletionRequestedAt)).toBe(true);
  });
});

describe("exports and PDFs", () => {
  it.each(["=SUM(A1)", "+CMD()", "@IMPORT", "-1+2"])(
    "neutralizes CSV formula %s",
    (v) => expect(csvCell(v)).toBe(`"'${v}"`),
  );
  it("escapes quotes", () =>
    expect(csvCell('A "quote"')).toBe('"A ""quote"""'));
  it("generates a real report PDF with amendments and pagination", async () => {
    const s = seedState("org-a");
    const r: Report = {
      id: "report",
      organizationId: "org-a",
      name: "Inspection",
      start: "2026-01-01",
      end: "2026-12-31",
      siteIds: ["main"],
      sections: ["Temperature records"],
      generatedAt: new Date().toISOString(),
      generatedBy: "Owner",
      generatedById: "demo-owner",
      status: "Ready",
      businessName: "Green Table Café",
      address: "Main Street",
      registrationId: "",
      entries: s.entries,
      issues: s.issues,
      watermarked: true,
      entryCount: s.entries.length,
      issueCount: s.issues.length,
    };
    const pdf = await reportPdf(r);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
  it("generates the free printable log", async () => {
    const pdf = await printableLogPdf("Café", "Fridge\nFreezer");
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("rejects an empty printable request", async () =>
    expect(printableLogPdf("Café", " \n ")).rejects.toThrow());
});
