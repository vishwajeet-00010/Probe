import { z } from "zod";
const text = z.string().trim().min(1).max(200);
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const note = z.string().trim().min(3).max(2000);
const task = z.object({
  id,
  label: text,
  type: z.enum([
    "Checkbox",
    "Temperature",
    "Number",
    "Text",
    "Required photo",
    "Yes/No",
  ]),
  required: z.boolean(),
  section: text,
  correctivePrompt: z.string().max(400),
});
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("equipment.create"),
      name: text,
      type: z.enum([
        "Fridge",
        "Freezer",
        "Hot Hold",
        "Display Chiller",
        "Cooking Core",
        "Delivery",
      ]),
      location: text,
      siteId: id,
      min: z.number().finite().min(-100).max(300),
      max: z.number().finite().min(-100).max(300),
      frequency: text,
    })
    .refine((v) => v.min < v.max, "Minimum must be below maximum."),
  z.object({ action: z.literal("equipment.archive"), id }),
  z.object({
    action: z.literal("entry.create"),
    id: z.string().uuid(),
    siteId: id,
    equipmentId: z.string().max(100),
    type: z.enum([
      "Temperature",
      "Checklist",
      "Delivery",
      "Cleaning",
      "Corrective action",
    ]),
    value: text,
    notes: z.string().max(2000),
    deviceTimestamp: z.iso.datetime(),
    failed: z.boolean().default(false),
    dueItemId: z.string().max(100).optional(),
    supplierId: z.string().max(100).optional(),
    templateVersionId: z.string().max(100).optional(),
  }),
  z.object({ action: z.literal("entry.amend"), id, value: text, reason: note }),
  z.object({
    action: z.literal("issue.create"),
    title: text,
    severity: z.enum(["Low", "Medium", "High"]),
    siteId: id,
    assignee: text,
    dueAt: z.iso.datetime(),
  }),
  z.object({
    action: z.literal("issue.transition"),
    id,
    status: z.enum(["In Progress", "Resolved", "Verified"]),
    note,
  }),
  z.object({
    action: z.literal("supplier.create"),
    name: text,
    email: z.email().or(z.literal("")),
    phone: z.string().max(80),
    categories: text,
    notes: z.string().max(2000),
  }),
  z.object({
    action: z.literal("template.save"),
    id: z.string().max(100).optional(),
    name: text,
    category: text,
    tasks: z.array(task).min(1).max(50),
  }),
  z.object({
    action: z.literal("schedule.create"),
    templateId: id,
    siteId: id,
    cadence: z.enum(["daily", "per shift", "weekly", "monthly", "custom"]),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    assignedTo: text,
  }),
  z.object({
    action: z.literal("team.invite"),
    name: text,
    email: z.email(),
    role: z.enum(["Manager", "Staff"]),
    siteIds: z.array(id).min(1),
  }),
  z.object({
    action: z.literal("team.update"),
    id,
    role: z.enum(["Manager", "Staff"]),
    status: z.enum(["Active", "Inactive"]),
  }),
  z.object({ action: z.literal("team.revoke"), id }),
  z.object({ action: z.literal("notification.read"), id }),
  z.object({
    action: z.literal("notification.preferences"),
    email: z.boolean(),
    push: z.boolean(),
    quietStart: z.string().regex(/^\d{2}:\d{2}$/),
    quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  z.object({
    action: z.literal("settings.save"),
    name: text,
    address: z.string().max(400),
    registrationId: z.string().max(100),
    region: text,
    units: z.enum(["C", "F"]),
    timezone: text,
  }),
  z
    .object({
      action: z.literal("limits.update"),
      id,
      min: z.number().finite().min(-100).max(300),
      max: z.number().finite().min(-100).max(300),
      reason: note,
    })
    .refine((v) => v.min < v.max, "Minimum must be below maximum."),
  z.object({
    action: z.literal("onboarding.save"),
    step: z.number().int().min(0).max(10),
    values: z.record(z.string().max(50), z.string().max(2000)),
  }),
  z.object({
    action: z.literal("site.create"),
    name: text,
    address: z.string().max(400),
  }),
  z.object({
    action: z.literal("account.delete-request"),
    confirmation: z.literal("DELETE"),
  }),
  z.object({ action: z.literal("demo.clear") }),
]);
export type Command = z.infer<typeof commandSchema>;
export const reportSchema = z
  .object({
    name: text,
    start: z.iso.date(),
    end: z.iso.date(),
    siteIds: z.array(id).min(1),
    sections: z
      .array(
        z.enum([
          "Temperature records",
          "Checklist completion",
          "Deliveries",
          "Corrective actions",
          "Cleaning records",
          "Sign-offs",
        ]),
      )
      .min(1),
  })
  .refine((v) => v.start <= v.end, "End date must follow start date.");
