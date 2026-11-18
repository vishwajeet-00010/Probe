import type { Actor, Entry, Issue, ShareLink, State } from "@/types/domain";
import { DomainError } from "./permissions";
export function outOfRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || min >= max)
    throw new DomainError("Invalid temperature or safe range.");
  return value < min || value > max;
}
export function suspiciousTiming(device: string, server: string) {
  return Math.abs(Date.parse(server) - Date.parse(device)) > 5 * 60 * 1000;
}
export function issueFromEntry(
  entry: Entry,
  actor: Actor,
  id: string,
): Issue | null {
  if (!["Out of range", "Failed", "Rejected"].includes(entry.status))
    return null;
  return {
    id,
    organizationId: actor.organizationId,
    title: `${entry.label}: ${entry.status.toLowerCase()}`,
    severity: entry.status === "Out of range" ? "High" : "Medium",
    sourceEntryId: entry.id,
    equipmentId: entry.equipmentId,
    siteId: entry.siteId,
    assignee: actor.name,
    dueAt: entry.serverTimestamp,
    createdAt: entry.serverTimestamp,
    status: "Open",
    timeline: [
      {
        at: entry.serverTimestamp,
        actor: actor.name,
        actorId: actor.uid,
        note:
          entry.notes.trim().length >= 3
            ? entry.notes
            : "Automatically opened from a failed record.",
        status: "Open",
      },
    ],
  };
}
export function assertShareAccess(
  link: ShareLink | undefined,
  now = Date.now(),
) {
  if (!link || link.revoked || Date.parse(link.expiresAt) <= now)
    throw new DomainError(
      "This inspection link has expired or been revoked.",
      404,
    );
  return link;
}
export function assertTransition(
  issue: Issue,
  next: Issue["status"],
  note: string,
) {
  if (note.trim().length < 3)
    throw new DomainError("Please add a corrective-action note.");
  const allowed: Record<Issue["status"], Issue["status"][]> = {
    Open: ["In Progress", "Resolved"],
    "In Progress": ["Resolved"],
    Resolved: ["Verified"],
    Verified: [],
  };
  if (!allowed[issue.status].includes(next))
    throw new DomainError("This issue cannot move to that status.", 409);
}
export function effectivePlan(state: State) {
  return Date.parse(state.organization.trialEndsAt) > Date.now()
    ? "Pro"
    : state.organization.plan;
}
export function checkCapacity(
  state: State,
  resource: "sites" | "equipment" | "memberships",
) {
  if (effectivePlan(state) !== "Free") return;
  const limits = { sites: 1, equipment: 3, memberships: 2 };
  const count =
    resource === "equipment"
      ? state.equipment.filter((e) => !e.archived).length
      : resource === "memberships"
        ? state.memberships.filter((m) => m.status !== "Inactive").length +
          state.invitations.filter((i) => i.status === "Invited").length
        : state.sites.length;
  if (count >= limits[resource])
    throw new DomainError(
      `Your Free plan allows ${limits[resource]} ${resource}. Existing records remain accessible.`,
      409,
    );
}
