import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, Report } from "@/types/domain";
import {
  entriesPage,
  mutate,
  readState,
  readRecord,
  issuesForPeriod,
} from "@/lib/database";
import { assertShareAccess, effectivePlan } from "@/lib/domain";
import { authorize, DomainError, tenantRecord } from "@/lib/permissions";
import { reportSchema } from "@/lib/validation";
import { audit } from "./commands";
export async function generateReport(
  actor: Actor,
  input: z.infer<typeof reportSchema>,
) {
  authorize(actor, "reports");
  const state = await readState(actor);
  for (const id of input.siteIds) tenantRecord(actor, state.sites, id);
  const entries: Report["entries"] = [];
  let scanned = 0;
  let cursor: string | undefined;
  do {
    const page = await entriesPage(actor, {
      start: `${input.start}T00:00:00.000Z`,
      end: `${input.end}T23:59:59.999Z`,
      cursor,
      limit: 100,
    });
    entries.push(...page.items.filter((e) => input.siteIds.includes(e.siteId)));
    scanned += page.items.length;
    if (scanned > 5000)
      throw new DomainError(
        "This report requires a background job. Choose a shorter period.",
        422,
      );
    cursor = page.nextCursor ?? undefined;
    if (entries.length > 500)
      throw new DomainError(
        "This synchronous report supports 500 records. Choose a shorter period; large background report jobs are not activated.",
        422,
      );
  } while (cursor);
  const included = new Set<string>(input.sections);
  const types: Record<string, string> = {
    Temperature: "Temperature records",
    Checklist: "Checklist completion",
    Delivery: "Deliveries",
    Cleaning: "Cleaning records",
    "Corrective action": "Corrective actions",
  };
  const report: Report = {
    id: randomUUID(),
    organizationId: actor.organizationId,
    ...input,
    generatedAt: new Date().toISOString(),
    generatedBy: actor.name,
    status: "Ready",
    businessName: state.organization.name,
    address: state.organization.address,
    registrationId: state.organization.registrationId,
    entries: entries.filter((e) => included.has(types[e.type])),
    issues: included.has("Corrective actions")
      ? (
          await issuesForPeriod(
            actor,
            `${input.start}T00:00:00.000Z`,
            `${input.end}T23:59:59.999Z`,
          )
        ).filter(
          (i) =>
            input.siteIds.includes(i.siteId) &&
            i.createdAt >= `${input.start}T00:00:00.000Z` &&
            i.createdAt <= `${input.end}T23:59:59.999Z`,
        )
      : [],
    watermarked: effectivePlan(state) === "Free",
  };
  if (Buffer.byteLength(JSON.stringify(report)) > 800000)
    throw new DomainError(
      "Report is too large. Select a shorter date range.",
      422,
    );
  await mutate(actor, (s) => {
    s.reports.unshift(report);
    audit(s, actor, "report.generated", report.id, null, {
      start: report.start,
      end: report.end,
    });
  });
  return report;
}
export async function createShare(
  actor: Actor,
  reportId: string,
  days: 1 | 7 | 30,
) {
  authorize(actor, "share");
  const token = `${actor.organizationId}~${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  await mutate(
    actor,
    (s) => {
      tenantRecord(actor, s.reports, reportId);
      if (effectivePlan(s) === "Free")
        throw new DomainError(
          "Share links require Pro. Your reports and exports remain available.",
          403,
        );
      s.shareLinks.push({
        id: hash,
        organizationId: actor.organizationId,
        reportId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
        revoked: false,
        accesses: 0,
        lastAccessAt: null,
      });
      audit(s, actor, "share.created", hash, null, { reportId, days });
    },
    [{ collection: "reports", id: reportId }],
  );
  return token;
}
export async function inspectReport(token: string) {
  if (!/^(demo-)?[a-f0-9-]{36}~[A-Za-z0-9_-]{43}$/.test(token))
    throw new DomainError("Inspection link not found.", 404);
  const organizationId = token.split("~")[0];
  const actor: Actor = {
    uid: "inspector",
    organizationId,
    name: "Inspector link visitor",
    role: "Owner",
    demo: organizationId.startsWith("demo-"),
    admin: false,
  };
  if (actor.demo && process.env.PROBE_DEMO_ENABLED !== "true")
    throw new DomainError("Link unavailable.", 404);
  const hash = createHash("sha256").update(token).digest("hex");
  const initial = assertShareAccess(
    await readRecord(actor, "shareLinks", hash),
  );
  return mutate(
    actor,
    (s) => {
      const link = assertShareAccess(
        s.shareLinks.find((l) => l.tokenHash === hash),
      );
      const report = tenantRecord(actor, s.reports, link.reportId);
      link.accesses++;
      link.lastAccessAt = new Date().toISOString();
      return report;
    },
    [
      { collection: "shareLinks", id: hash },
      { collection: "reports", id: initial.reportId },
    ],
  );
}
