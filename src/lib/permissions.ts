import type { Actor, Role, TenantRecord } from "@/types/domain";
export type Permission =
  | "read"
  | "capture"
  | "manage"
  | "amend"
  | "verify"
  | "reports"
  | "team"
  | "billing"
  | "share"
  | "settings"
  | "delete";
const permissions: Record<Role, readonly Permission[]> = {
  Owner: [
    "read",
    "capture",
    "manage",
    "amend",
    "verify",
    "reports",
    "team",
    "billing",
    "share",
    "settings",
    "delete",
  ],
  Manager: ["read", "capture", "manage", "amend", "verify", "reports", "team"],
  Staff: ["capture"],
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function can(role: Role, permission: Permission) {
  return permissions[role].includes(permission);
}
export function authorize(actor: Actor, permission: Permission) {
  if (!can(actor.role, permission))
    throw new DomainError(
      "You do not have permission to perform this action.",
      403,
    );
}
export function tenantRecord<T extends TenantRecord>(
  actor: Actor,
  rows: T[],
  id: string,
): T {
  const record = rows.find(
    (row) => row.id === id && row.organizationId === actor.organizationId,
  );
  if (!record) throw new DomainError("Record not found.", 404);
  return record;
}
export function assertTenant(actor: Actor, organizationId: string) {
  if (actor.organizationId !== organizationId)
    throw new DomainError("Organization access denied.", 403);
}
export function mayChangeRole(actor: Actor, target: Role, next: Role) {
  authorize(actor, "team");
  if (
    target === "Owner" ||
    next === "Owner" ||
    (actor.role === "Manager" && (target !== "Staff" || next !== "Staff"))
  )
    throw new DomainError(
      "Only an owner can manage managers. Ownership transfer is not supported here.",
      403,
    );
}
