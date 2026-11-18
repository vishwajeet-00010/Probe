const randomUUID = () => globalThis.crypto.randomUUID();
import type { Actor, State, Entry } from "@/types/domain";
import type { Command } from "@/lib/validation";
import {
  assertTenant,
  authorize,
  DomainError,
  mayChangeRole,
  tenantRecord,
} from "@/lib/permissions";
import {
  assertTransition,
  checkCapacity,
  issueFromEntry,
  outOfRange,
  suspiciousTiming,
} from "@/lib/domain";
export function audit(
  s: State,
  a: Actor,
  action: string,
  entity: string,
  oldValue: unknown,
  newValue: unknown,
) {
  s.auditEvents.unshift({
    id: randomUUID(),
    organizationId: a.organizationId,
    actor: a.name,
    actorId: a.uid,
    at: new Date().toISOString(),
    action,
    entity,
    // Rules cap audit values at 20,000 characters.
    oldValue: String(JSON.stringify(oldValue)).slice(0, 20000),
    newValue: String(JSON.stringify(newValue)).slice(0, 20000),
    metadata: {},
  });
}
export function applyCommand(s: State, a: Actor, c: Command) {
  assertTenant(a, s.organization.id);
  const now = new Date().toISOString(),
    id = randomUUID(),
    base = { id, organizationId: a.organizationId };
  switch (c.action) {
    case "equipment.create":
      authorize(a, "manage");
      checkCapacity(s, "equipment");
      tenantRecord(a, s.sites, c.siteId);
      s.equipment.push({
        ...base,
        name: c.name,
        type: c.type,
        location: c.location,
        siteId: c.siteId,
        min: c.min,
        max: c.max,
        frequency: c.frequency,
        archived: false,
      });
      break;
    case "equipment.archive": {
      authorize(a, "manage");
      const e = tenantRecord(a, s.equipment, c.id);
      e.archived = true;
      break;
    }
    case "entry.create": {
      authorize(a, "capture");
      tenantRecord(a, s.sites, c.siteId);
      const duplicate = s.entries.find((e) => e.id === c.id);
      if (duplicate) return { id: duplicate.id };
      const membership = s.memberships.find((m) => m.userId === a.uid);
      if (a.role === "Staff" && !membership?.siteIds.includes(c.siteId))
        throw new DomainError("You are not assigned to this site.", 403);
      const equipment = c.equipmentId
        ? tenantRecord(a, s.equipment, c.equipmentId)
        : null;
      if (equipment && (equipment.archived || equipment.siteId !== c.siteId))
        throw new DomainError("Equipment is unavailable at this site.");
      const due = c.dueItemId ? tenantRecord(a, s.dueItems, c.dueItemId) : null;
      if (
        due &&
        (due.siteId !== c.siteId ||
          due.status === "Done" ||
          (due.equipmentId && due.equipmentId !== c.equipmentId))
      )
        throw new DomainError(
          "This scheduled check cannot be completed by this entry.",
          409,
        );
      const version = c.templateVersionId
        ? tenantRecord(a, s.templateVersions, c.templateVersionId)
        : null;
      if (c.supplierId) tenantRecord(a, s.suppliers, c.supplierId);
      let status: Entry["status"] = c.failed
        ? c.type === "Delivery"
          ? "Rejected"
          : "Failed"
        : "Done";
      let numericValue: number | null = null;
      if (c.type === "Temperature") {
        if (!equipment)
          throw new DomainError("Select equipment for this reading.");
        numericValue = Number(c.value);
        if (c.value.trim() === "" || !Number.isFinite(numericValue))
          throw new DomainError("Enter a valid numeric temperature.");
        if (outOfRange(numericValue, equipment.min, equipment.max))
          status = "Out of range";
      }
      if (c.failed && c.notes.trim().length < 3)
        throw new DomainError(
          "Record a corrective-action note for a failed check.",
        );
      const entry: Entry = {
        ...base,
        id: c.id,
        siteId: c.siteId,
        equipmentId: c.equipmentId,
        templateVersionId: version?.id ?? due?.templateVersionId ?? "",
        supplierId: c.supplierId ?? "",
        dueItemId: c.dueItemId ?? "",
        type: c.type,
        label: equipment?.name ?? version?.name ?? due?.title ?? c.type,
        value: c.type === "Temperature" ? `${c.value} °C` : c.value,
        numericValue,
        status,
        staff: a.name,
        actorId: a.uid,
        serverTimestamp: now,
        deviceTimestamp: c.deviceTimestamp,
        timingFlag: suspiciousTiming(c.deviceTimestamp, now),
        notes: c.notes,
        amendments: [],
        attachmentIds: [],
        issueId: null,
      };
      const issue = issueFromEntry(entry, a, id);
      if (issue) {
        entry.issueId = issue.id;
        s.issues.unshift(issue);
        s.notifications.unshift({
          ...base,
          id: randomUUID(),
          title: issue.title,
          body: c.notes || "A failed check needs review.",
          type: "Out-of-range reading",
          createdAt: now,
          readBy: [],
          href: "/app/issues",
        });
      }
      s.entries.unshift(entry);
      if (due) {
        due.status = "Done";
        due.completedAt = now;
      }
      break;
    }
    case "entry.amend": {
      authorize(a, "amend");
      const e = tenantRecord(a, s.entries, c.id);
      e.amendments.push({
        id,
        actor: a.name,
        actorId: a.uid,
        at: now,
        reason: c.reason,
        value: c.value,
      });
      audit(
        s,
        a,
        c.action,
        c.id,
        { original: e.value },
        { amendment: c.value, reason: c.reason },
      );
      return { id };
    }
    case "issue.create":
      authorize(a, "manage");
      tenantRecord(a, s.sites, c.siteId);
      s.issues.unshift({
        ...base,
        title: c.title,
        severity: c.severity,
        sourceEntryId: "",
        equipmentId: "",
        siteId: c.siteId,
        assignee: c.assignee,
        dueAt: c.dueAt,
        createdAt: now,
        status: "Open",
        timeline: [
          {
            at: now,
            actor: a.name,
            actorId: a.uid,
            note: "Issue opened manually.",
            status: "Open",
          },
        ],
      });
      break;
    case "issue.transition": {
      authorize(a, c.status === "Verified" ? "verify" : "manage");
      const issue = tenantRecord(a, s.issues, c.id);
      assertTransition(issue, c.status, c.note);
      const old = issue.status;
      issue.status = c.status;
      issue.timeline.push({
        at: now,
        actor: a.name,
        actorId: a.uid,
        note: c.note,
        status: c.status,
      });
      audit(s, a, c.action, c.id, old, { status: c.status, note: c.note });
      return { id: c.id };
    }
    case "supplier.create":
      authorize(a, "manage");
      s.suppliers.push({
        ...base,
        name: c.name,
        email: c.email,
        phone: c.phone,
        categories: c.categories,
        notes: c.notes,
      });
      break;
    case "template.save": {
      authorize(a, "manage");
      const template = c.id
        ? tenantRecord(a, s.templates, c.id)
        : {
            ...base,
            name: c.name,
            category: c.category,
            currentVersionId: "",
            archived: false,
          };
      const vid = randomUUID();
      const version = c.id
        ? s.templateVersions
            .filter((v) => v.templateId === c.id)
            .reduce((n, v) => Math.max(n, v.version), 0) + 1
        : 1;
      s.templateVersions.push({
        id: vid,
        organizationId: a.organizationId,
        templateId: template.id,
        version,
        name: c.name,
        category: c.category,
        tasks: c.tasks,
        createdAt: now,
      });
      template.name = c.name;
      template.category = c.category;
      template.currentVersionId = vid;
      if (!c.id) s.templates.push(template);
      break;
    }
    case "schedule.create":
      authorize(a, "manage");
      tenantRecord(a, s.templates, c.templateId);
      tenantRecord(a, s.sites, c.siteId);
      s.schedules.push({
        ...base,
        templateId: c.templateId,
        siteId: c.siteId,
        cadence: c.cadence,
        time: c.time,
        assignedTo: c.assignedTo,
      });
      break;
    case "team.invite": {
      authorize(a, "team");
      checkCapacity(s, "memberships");
      if (a.role === "Manager" && c.role !== "Staff")
        throw new DomainError("Managers can invite Staff only.", 403);
      for (const site of c.siteIds) tenantRecord(a, s.sites, site);
      const email = c.email.toLowerCase();
      if (s.memberships.some((m) => m.email.toLowerCase() === email))
        throw new DomainError("This email is already on your team.", 409);
      const existing = s.invitations.find((i) => i.id === email);
      if (existing && existing.status !== "Revoked")
        throw new DomainError("This email already has an invitation.", 409);
      const invitation = {
        id: email,
        organizationId: a.organizationId,
        email,
        name: c.name,
        role: c.role,
        siteIds: c.siteIds,
        status: "Invited" as const,
        invitedBy: a.uid,
        createdAt: now,
      };
      if (existing) Object.assign(existing, invitation);
      else s.invitations.push(invitation);
      break;
    }
    case "team.update": {
      const m = tenantRecord(a, s.memberships, c.id);
      mayChangeRole(a, m.role, c.role);
      const old = { role: m.role, status: m.status };
      m.role = c.role;
      m.status = c.status;
      audit(s, a, c.action, c.id, old, { role: m.role, status: m.status });
      return { id: c.id };
    }
    case "team.revoke": {
      authorize(a, "team");
      const invite = tenantRecord(a, s.invitations, c.id);
      mayChangeRole(a, invite.role, invite.role);
      if (invite.status !== "Invited")
        throw new DomainError("Only pending invitations can be revoked.");
      invite.status = "Revoked";
      break;
    }
    case "notification.read": {
      authorize(a, "read");
      const n = tenantRecord(a, s.notifications, c.id);
      if (!n.readBy.includes(a.uid)) n.readBy.push(a.uid);
      break;
    }
    case "notification.preferences": {
      authorize(a, "read");
      const preference = {
        ...base,
        id: a.uid,
        userId: a.uid,
        email: c.email,
        push: c.push,
        quietStart: c.quietStart,
        quietEnd: c.quietEnd,
      };
      s.notificationPreferences = s.notificationPreferences.filter(
        (p) => p.userId !== a.uid,
      );
      s.notificationPreferences.push(preference);
      break;
    }
    case "settings.save":
      authorize(a, "settings");
      Object.assign(s.organization, {
        name: c.name,
        address: c.address,
        registrationId: c.registrationId,
        region: c.region,
        units: c.units,
        timezone: c.timezone,
      });
      break;
    case "limits.update": {
      authorize(a, "settings");
      const e = tenantRecord(a, s.equipment, c.id);
      const old = { min: e.min, max: e.max };
      e.min = c.min;
      e.max = c.max;
      audit(s, a, c.action, c.id, old, {
        min: c.min,
        max: c.max,
        reason: c.reason,
      });
      return { id: c.id };
    }
    case "onboarding.save":
      authorize(a, "settings");
      s.organization.onboardingStep = c.step;
      Object.assign(s.organization.onboarding, c.values);
      if (c.values.name) s.organization.name = c.values.name;
      if (c.values.region) s.organization.region = c.values.region;
      if (c.values.units === "C" || c.values.units === "F")
        s.organization.units = c.values.units;
      if (c.values.siteName) s.sites[0].name = c.values.siteName;
      break;
    case "site.create":
      authorize(a, "settings");
      checkCapacity(s, "sites");
      s.sites.push({ ...base, name: c.name, address: c.address });
      break;
    case "account.delete-request":
      authorize(a, "delete");
      s.organization.deletionRequestedAt = now;
      break;
  }
  audit(
    s,
    a,
    c.action,
    "id" in c ? String(c.id) : id,
    null,
    c.action === "entry.create" ? { type: c.type, value: c.value } : c,
  );
  return { id };
}
