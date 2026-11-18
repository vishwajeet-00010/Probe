export type Role = "Owner" | "Manager" | "Staff";
export type EntryType =
  "Temperature" | "Checklist" | "Delivery" | "Cleaning" | "Corrective action";
export type Severity = "Low" | "Medium" | "High";
export type IssueStatus = "Open" | "In Progress" | "Resolved" | "Verified";
export interface TenantRecord {
  id: string;
  organizationId: string;
}
export interface Organization {
  id: string;
  name: string;
  address: string;
  registrationId: string;
  region: string;
  units: "C" | "F";
  timezone: string;
  onboardingStep: number;
  onboarding: Record<string, string>;
  ownerId: string;
  createdAt: string;
  /** Stored as "Free"; the client overlays the RevenueCat entitlement. */
  plan: "Free" | "Pro" | "Group";
  /** Derived on read: createdAt + 14 days (not stored). */
  trialEndsAt: string;
  deletionRequestedAt?: string;
}
export interface Site extends TenantRecord {
  name: string;
  address: string;
}
export interface Membership extends TenantRecord {
  userId: string;
  name: string;
  email: string;
  role: Role;
  siteIds: string[];
  status: "Active" | "Inactive";
  lastActive: string;
}
/** Doc ID is the lower-cased email. No email is sent: the invitee signs up with it. */
export interface Invitation extends TenantRecord {
  email: string;
  name: string;
  role: "Manager" | "Staff";
  siteIds: string[];
  status: "Invited" | "Revoked" | "Accepted";
  invitedBy: string;
  createdAt: string;
  acceptedBy?: string;
}
export interface Equipment extends TenantRecord {
  name: string;
  type: string;
  location: string;
  siteId: string;
  min: number;
  max: number;
  frequency: string;
  archived: boolean;
}
export interface Amendment {
  id: string;
  actor: string;
  actorId: string;
  at: string;
  reason: string;
  value: string;
}
export interface Entry extends TenantRecord {
  siteId: string;
  equipmentId: string;
  templateVersionId: string;
  supplierId: string;
  dueItemId: string;
  type: EntryType;
  label: string;
  value: string;
  numericValue: number | null;
  status: "Done" | "Out of range" | "Failed" | "Rejected";
  staff: string;
  actorId: string;
  serverTimestamp: string;
  deviceTimestamp: string;
  /** Derived on read: |server - device| > 5 minutes (not stored). */
  timingFlag: boolean;
  notes: string;
  amendments: Amendment[];
  attachmentIds: string[];
  issueId: string | null;
}
export interface Issue extends TenantRecord {
  title: string;
  severity: Severity;
  sourceEntryId: string;
  equipmentId: string;
  siteId: string;
  assignee: string;
  dueAt: string;
  createdAt: string;
  status: IssueStatus;
  timeline: {
    at: string;
    actor: string;
    actorId: string;
    note: string;
    status: IssueStatus;
  }[];
}
export interface Task {
  id: string;
  label: string;
  type:
    | "Checkbox"
    | "Temperature"
    | "Number"
    | "Text"
    | "Required photo"
    | "Yes/No";
  required: boolean;
  section: string;
  correctivePrompt: string;
}
export interface TemplateVersion extends TenantRecord {
  templateId: string;
  version: number;
  name: string;
  category: string;
  tasks: Task[];
  createdAt: string;
}
export interface Template extends TenantRecord {
  name: string;
  category: string;
  currentVersionId: string;
  archived: boolean;
}
export interface Schedule extends TenantRecord {
  templateId: string;
  siteId: string;
  cadence: string;
  time: string;
  assignedTo: string;
}
export interface DueItem extends TenantRecord {
  title: string;
  siteId: string;
  equipmentId: string;
  templateVersionId: string;
  dueAt: string;
  assignedTo: string;
  status: "Done" | "Due" | "Overdue" | "Skipped" | "N/A";
  completedAt: string | null;
}
export interface Supplier extends TenantRecord {
  name: string;
  email: string;
  phone: string;
  categories: string;
  notes: string;
}
export interface Report extends TenantRecord {
  name: string;
  start: string;
  end: string;
  siteIds: string[];
  sections: string[];
  generatedAt: string;
  generatedBy: string;
  generatedById: string;
  status: "Ready";
  businessName: string;
  address: string;
  registrationId: string;
  watermarked: boolean;
  entryCount: number;
  issueCount: number;
  /** Loaded from reportSnapshots/{id} only when needed (PDF, sharing). */
  entries: Entry[];
  issues: Issue[];
}
/** sharedReports/{token}: the doc ID is the secret inspector token. */
export interface ShareLink extends TenantRecord {
  reportId: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  accesses: number;
  lastAccessAt: string | null;
}
export interface Notification extends TenantRecord {
  title: string;
  body: string;
  type: string;
  createdAt: string;
  readBy: string[];
  href: string;
}
export interface AuditEvent extends TenantRecord {
  actor: string;
  actorId: string;
  at: string;
  action: string;
  entity: string;
  oldValue: string;
  newValue: string;
  metadata: Record<string, string>;
}
export interface Attachment extends TenantRecord {
  entryId: string;
  path: string;
  contentType: string;
  size: number;
}
export interface NotificationPreference extends TenantRecord {
  userId: string;
  email: boolean;
  push: boolean;
  quietStart: string;
  quietEnd: string;
}
export interface State {
  organization: Organization;
  sites: Site[];
  memberships: Membership[];
  invitations: Invitation[];
  equipment: Equipment[];
  entries: Entry[];
  issues: Issue[];
  templates: Template[];
  templateVersions: TemplateVersion[];
  schedules: Schedule[];
  dueItems: DueItem[];
  suppliers: Supplier[];
  reports: Report[];
  shareLinks: ShareLink[];
  notifications: Notification[];
  auditEvents: AuditEvent[];
  notificationPreferences: NotificationPreference[];
}
export type Collection = Exclude<keyof State, "organization">;
export interface Actor {
  uid: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  admin: boolean;
}
