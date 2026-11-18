import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  can,
  authorize,
  tenantRecord,
  assertTenant,
  mayChangeRole,
} from "@/lib/permissions";
import {
  outOfRange,
  suspiciousTiming,
  issueFromEntry,
  assertShareAccess,
  checkCapacity,
} from "@/lib/domain";
import { seedState, emptyState } from "@/lib/seed";
import { commandSchema } from "@/lib/validation";
import { applyCommand } from "@/services/commands";
import type { Actor, ShareLink } from "@/types/domain";
const owner: Actor = {
  uid: "demo-owner",
  organizationId: "org-a",
  name: "Alex Morgan",
  email: "alex@example.test",
  role: "Owner",
  admin: false,
};
const staff: Actor = { ...owner, role: "Staff" };
const manager: Actor = { ...owner, role: "Manager" };
describe("central authorization", () => {
  it("permits owners to manage billing", () =>
    expect(can("Owner", "billing")).toBe(true));
  it("denies manager billing operations", () =>
    expect(() => authorize(manager, "billing")).toThrow());
  it("denies staff reading management snapshots", () =>
    expect(() => authorize(staff, "read")).toThrow());
  it("denies staff owner actions", () =>
    expect(() => authorize(staff, "settings")).toThrow());
  it("allows staff capture", () =>
    expect(() => authorize(staff, "capture")).not.toThrow());
  it("prevents manager promotion of staff", () =>
    expect(() => mayChangeRole(manager, "Staff", "Manager")).toThrow());
  it("protects owner memberships", () =>
    expect(() => mayChangeRole(owner, "Owner", "Staff")).toThrow());
  it("permits manager deactivation of staff", () =>
    expect(() => mayChangeRole(manager, "Staff", "Staff")).not.toThrow());
});
describe("tenant isolation", () => {
  it("rejects a foreign tenant context", () =>
    expect(() => assertTenant(owner, "org-b")).toThrow());
  it("rejects a guessed foreign record ID", () =>
    expect(() =>
      tenantRecord(owner, [{ id: "known", organizationId: "org-b" }], "known"),
    ).toThrow());
  it("cannot inject equipment from another tenant into a capture", () => {
    const s = seedState("org-a");
    s.equipment[0].organizationId = "org-b";
    expect(() =>
      applyCommand(s, owner, {
        action: "entry.create",
        id: randomUUID(),
        siteId: "main",
        equipmentId: "walk-in",
        type: "Temperature",
        value: "4",
        notes: "",
        deviceTimestamp: new Date().toISOString(),
        failed: false,
      }),
    ).toThrow();
  });
  it("rejects commands using a different organization state", () =>
    expect(() =>
      applyCommand(seedState("org-b"), owner, {
        action: "equipment.archive",
        id: "walk-in",
      }),
    ).toThrow());
});
describe("temperature and timing", () => {
  it.each([0, 2.5, 5])("accepts inclusive safe temperature %s", (n) =>
    expect(outOfRange(n, 0, 5)).toBe(false),
  );
  it.each([-1, 5.1, 8.2])("flags unsafe temperature %s", (n) =>
    expect(outOfRange(n, 0, 5)).toBe(true),
  );
  it("rejects NaN", () => expect(() => outOfRange(NaN, 0, 5)).toThrow());
  it("flags more than 5 minutes clock skew", () =>
    expect(
      suspiciousTiming("2026-01-01T00:00:00Z", "2026-01-01T00:05:01Z"),
    ).toBe(true));
  it("allows exactly five minutes", () =>
    expect(
      suspiciousTiming("2026-01-01T00:00:00Z", "2026-01-01T00:05:00Z"),
    ).toBe(false));
  it("flags offline capture more than 24 hours old", () =>
    expect(
      suspiciousTiming("2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z"),
    ).toBe(true));
  it("rejects inverted limits at runtime", () =>
    expect(
      commandSchema.safeParse({
        action: "limits.update",
        id: "walk-in",
        min: 6,
        max: 5,
        reason: "Reviewed limits",
      }).success,
    ).toBe(false));
});
describe("record to corrective action workflow", () => {
  it("atomically creates excursion entry, issue, notification and audit", () => {
    const s = seedState("org-a"),
      id = randomUUID();
    applyCommand(s, owner, {
      action: "entry.create",
      id,
      siteId: "main",
      equipmentId: "walk-in",
      type: "Temperature",
      value: "9",
      notes: "Moved stock to backup fridge",
      deviceTimestamp: new Date().toISOString(),
      failed: false,
    });
    const e = s.entries.find((e) => e.id === id)!;
    expect(e.status).toBe("Out of range");
    expect(e.issueId).toBeTruthy();
    expect(s.issues.find((i) => i.id === e.issueId)?.severity).toBe("High");
    expect(s.notifications[0].title).toContain("Walk-in");
    expect(s.auditEvents[0].action).toBe("entry.create");
  });
  it("does not create an issue for an in-range entry", () => {
    const s = seedState("org-a");
    expect(
      issueFromEntry(
        s.entries.find((e) => e.status === "Done")!,
        owner,
        "new",
      ),
    ).toBe(null);
  });
  it("deduplicates capture retries", () => {
    const s = seedState("org-a"),
      id = randomUUID(),
      c = {
        action: "entry.create" as const,
        id,
        siteId: "main",
        equipmentId: "walk-in",
        type: "Temperature" as const,
        value: "9",
        notes: "",
        deviceTimestamp: new Date().toISOString(),
        failed: false,
      };
    applyCommand(s, owner, c);
    applyCommand(s, owner, c);
    expect(s.entries.filter((e) => e.id === id)).toHaveLength(1);
    expect(s.issues.filter((i) => i.sourceEntryId === id)).toHaveLength(1);
  });
  it("requires a note when resolving", () => {
    const s = seedState("org-a");
    expect(() =>
      applyCommand(s, manager, {
        action: "issue.transition",
        id: "issue-display",
        status: "Resolved",
        note: "",
      }),
    ).toThrow();
  });
  it("requires resolution before verification", () => {
    const s = seedState("org-a");
    expect(() =>
      applyCommand(s, manager, {
        action: "issue.transition",
        id: "issue-display",
        status: "Verified",
        note: "Reviewed evidence",
      }),
    ).toThrow();
  });
  it("requires manager verification of high severity", () => {
    const s = seedState("org-a");
    applyCommand(s, manager, {
      action: "issue.transition",
      id: "issue-display",
      status: "Resolved",
      note: "Replaced door seal; temperature now 3.5 C.",
    });
    expect(() =>
      applyCommand(s, staff, {
        action: "issue.transition",
        id: "issue-display",
        status: "Verified",
        note: "Checked",
      }),
    ).toThrow();
    applyCommand(s, manager, {
      action: "issue.transition",
      id: "issue-display",
      status: "Verified",
      note: "Verified safe temperature and repair.",
    });
    expect(s.issues[0].status).toBe("Verified");
  });
  it("preserves original values when amending", () => {
    const s = seedState("org-a"),
      e = s.entries[0],
      original = e.value;
    applyCommand(s, manager, {
      action: "entry.amend",
      id: e.id,
      value: "3.4 °C",
      reason: "Transcription error checked against device.",
    });
    expect(e.value).toBe(original);
    expect(e.amendments).toHaveLength(1);
    expect(s.auditEvents[0].action).toBe("entry.amend");
  });
  it("requires an amendment reason in API schema", () =>
    expect(
      commandSchema.safeParse({
        action: "entry.amend",
        id: "entry-1",
        value: "4",
        reason: "",
      }).success,
    ).toBe(false));
  it("prevents staff amendments", () => {
    const s = seedState("org-a");
    expect(() =>
      applyCommand(s, staff, {
        action: "entry.amend",
        id: s.entries[0].id,
        value: "4",
        reason: "Correction",
      }),
    ).toThrow();
  });
  it("keeps prior template versions", () => {
    const s = seedState("org-a"),
      old = s.templates[0].currentVersionId;
    applyCommand(s, manager, {
      action: "template.save",
      id: s.templates[0].id,
      name: "Updated opening",
      category: "Opening",
      tasks: s.templateVersions[0].tasks,
    });
    expect(s.templates[0].currentVersionId).not.toBe(old);
    expect(s.templateVersions.some((v) => v.id === old)).toBe(true);
  });
});
describe("share link boundaries", () => {
  const link: ShareLink = {
    id: "link",
    organizationId: "org-a",
    reportId: "report-a",
    createdAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-12-01T00:00:00Z",
    revoked: false,
    accesses: 0,
    lastAccessAt: null,
  };
  it("allows a valid link", () =>
    expect(assertShareAccess(link, Date.parse("2026-11-01"))).toBe(link));
  it("denies exactly at expiry", () =>
    expect(() =>
      assertShareAccess(link, Date.parse(link.expiresAt)),
    ).toThrow());
  it("denies revoked links", () =>
    expect(() => assertShareAccess({ ...link, revoked: true }, 0)).toThrow());
  it("denies missing links", () =>
    expect(() => assertShareAccess(undefined)).toThrow());
  it("cannot resolve a report from another organization", () =>
    expect(() =>
      tenantRecord(
        owner,
        [{ id: "report-a", organizationId: "org-b" }],
        link.reportId,
      ),
    ).toThrow());
});
describe("plan integrity", () => {
  it("limits new free equipment without deleting history", () => {
    const s = seedState("org-a");
    s.organization.trialEndsAt = "2020-01-01";
    const count = s.entries.length;
    expect(() => checkCapacity(s, "equipment")).toThrow();
    expect(s.entries).toHaveLength(count);
  });
  it("allows creation during no-card Pro trial", () =>
    expect(() => checkCapacity(seedState("org-a"), "equipment")).not.toThrow());
  it("starts new organizations empty with an owner", () => {
    const s = emptyState("new");
    expect(s.entries).toHaveLength(0);
    expect(s.memberships[0].role).toBe("Owner");
    expect(s.organization.onboardingStep).toBe(0);
  });
});
describe("team invitations", () => {
  it("stores invitations by lower-cased email, not as memberships", () => {
    const s = seedState("org-a");
    const members = s.memberships.length;
    applyCommand(s, owner, {
      action: "team.invite",
      name: "Sam Lee",
      email: "Sam@Example.test",
      role: "Staff",
      siteIds: ["main"],
    });
    expect(s.memberships).toHaveLength(members);
    expect(s.invitations[0]).toMatchObject({
      id: "sam@example.test",
      status: "Invited",
      invitedBy: owner.uid,
    });
  });
  it("prevents managers inviting managers", () =>
    expect(() =>
      applyCommand(seedState("org-a"), manager, {
        action: "team.invite",
        name: "Pat",
        email: "pat@example.test",
        role: "Manager",
        siteIds: ["main"],
      }),
    ).toThrow());
  it("revokes a pending invitation and allows a re-invite", () => {
    const s = seedState("org-a");
    const invite = {
      action: "team.invite" as const,
      name: "Sam Lee",
      email: "sam@example.test",
      role: "Staff" as const,
      siteIds: ["main"],
    };
    applyCommand(s, owner, invite);
    expect(() => applyCommand(s, owner, invite)).toThrow();
    applyCommand(s, owner, { action: "team.revoke", id: "sam@example.test" });
    expect(s.invitations[0].status).toBe("Revoked");
    applyCommand(s, owner, invite);
    expect(s.invitations).toHaveLength(1);
    expect(s.invitations[0].status).toBe("Invited");
  });
  it("records the acting user id on audit events", () => {
    const s = seedState("org-a");
    applyCommand(s, owner, {
      action: "supplier.create",
      name: "New Supplier",
      email: "",
      phone: "",
      categories: "Dry goods",
      notes: "",
    });
    expect(s.auditEvents[0].actorId).toBe(owner.uid);
  });
});
