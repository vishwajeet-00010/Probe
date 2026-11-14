import type { State } from "@/types/domain";
export function emptyState(
  id: string,
  name = "Your business",
  uid = "owner",
  email = "",
): State {
  const now = new Date().toISOString();
  return {
    organization: {
      id,
      name,
      address: "",
      registrationId: "",
      region: "United Kingdom",
      units: "C",
      timezone: "Europe/London",
      onboardingStep: 0,
      onboarding: {},
      demo: false,
      plan: "Free",
      trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    },
    sites: [{ id: "main", organizationId: id, name: "Main site", address: "" }],
    memberships: [
      {
        id: uid,
        organizationId: id,
        userId: uid,
        name: "Owner",
        email,
        role: "Owner",
        siteIds: ["main"],
        status: "Active",
        lastActive: now,
      },
    ],
    equipment: [],
    entries: [],
    issues: [],
    templates: [],
    templateVersions: [],
    schedules: [],
    dueItems: [],
    suppliers: [],
    reports: [],
    shareLinks: [],
    notifications: [],
    auditEvents: [],
    subscriptions: [],
    notificationPreferences: [],
  };
}
export function seedState(id: string): State {
  const s = emptyState(
    id,
    "Green Table Café",
    "demo-owner",
    "alex@example.test",
  );
  s.organization.demo = true;
  s.organization.onboardingStep = 10;
  s.organization.address = "24 Main Street, Bristol";
  s.memberships[0].name = "Alex Morgan";
  s.sites[0].name = "Main Street";
  s.sites[0].address = s.organization.address;
  s.memberships.push(
    {
      id: "mia",
      organizationId: id,
      userId: "mia",
      name: "Mia Chen",
      email: "mia@example.test",
      role: "Manager",
      siteIds: ["main"],
      status: "Active",
      lastActive: new Date().toISOString(),
    },
    {
      id: "james",
      organizationId: id,
      userId: "james",
      name: "James Wilson",
      email: "james@example.test",
      role: "Staff",
      siteIds: ["main"],
      status: "Active",
      lastActive: new Date().toISOString(),
    },
  );
  s.equipment = [
    ["walk-in", "Walk-in Fridge", "Fridge", "Kitchen", 0, 5],
    ["display", "Display Fridge", "Display Chiller", "Front of house", 0, 5],
    ["freezer", "Main Freezer", "Freezer", "Storage", -25, -18],
    ["hot-hold", "Hot Hold Station", "Hot Hold", "Service", 63, 90],
  ].map(([eid, name, type, location, min, max]) => ({
    id: String(eid),
    organizationId: id,
    name: String(name),
    type: String(type),
    location: String(location),
    siteId: "main",
    min: Number(min),
    max: Number(max),
    frequency: "Twice daily",
    archived: false,
  }));
  for (let day = 6; day >= 0; day--)
    for (let i = 0; i < 4; i++) {
      const equipment = s.equipment[i];
      const time = new Date();
      time.setUTCDate(time.getUTCDate() - day);
      time.setUTCHours(8 + i, 15, 0, 0);
      const bad = day === 0 && i === 1;
      const n = bad
        ? 8.2
        : i === 2
          ? -20.1
          : i === 3
            ? 67.5
            : 3.2 + (day % 3) * 0.3;
      s.entries.push({
        id: `entry-${day}-${i}`,
        organizationId: id,
        siteId: "main",
        equipmentId: equipment.id,
        templateVersionId: "",
        supplierId: "",
        type: "Temperature",
        label: equipment.name,
        value: `${n} °C`,
        numericValue: n,
        status: bad ? "Out of range" : "Done",
        staff: i % 2 ? "Mia Chen" : "James Wilson",
        actorId: i % 2 ? "mia" : "james",
        serverTimestamp: time.toISOString(),
        deviceTimestamp: time.toISOString(),
        timingFlag: false,
        notes: bad
          ? "Door seal appears loose. Moved stock to walk-in fridge."
          : "Opening temperature check.",
        amendments: [],
        attachmentIds: [],
        issueId: bad ? "issue-display" : null,
      });
    }
  const bad = s.entries.find((e) => e.issueId)!;
  s.issues = [
    {
      id: "issue-display",
      organizationId: id,
      title: "Display Fridge above safe range",
      severity: "High",
      sourceEntryId: bad.id,
      equipmentId: "display",
      siteId: "main",
      assignee: "Mia Chen",
      dueAt: bad.serverTimestamp,
      createdAt: bad.serverTimestamp,
      status: "Open",
      timeline: [
        {
          at: bad.serverTimestamp,
          actor: "Mia Chen",
          note: bad.notes,
          status: "Open",
        },
      ],
    },
  ];
  for (const [i, category] of [
    "Opening",
    "Closing",
    "Cleaning",
    "Delivery",
    "Cooling",
    "Reheating",
    "Allergen checks",
  ].entries()) {
    const tid = `template-${i}`,
      vid = `${tid}-v1`;
    s.templates.push({
      id: tid,
      organizationId: id,
      name: `${category} checklist`,
      category,
      currentVersionId: vid,
      archived: false,
    });
    s.templateVersions.push({
      id: vid,
      organizationId: id,
      templateId: tid,
      version: 1,
      name: `${category} checklist`,
      category,
      createdAt: new Date().toISOString(),
      tasks: [
        {
          id: `task-${i}`,
          label:
            category === "Cleaning"
              ? "Clean and sanitise food-contact surfaces"
              : `Complete ${category.toLowerCase()} checks`,
          type: "Checkbox",
          required: true,
          section: "General",
          correctivePrompt: "Record the action taken if this check fails.",
        },
      ],
    });
  }
  for (let i = 0; i < 12; i++) {
    const time = new Date();
    time.setUTCHours(i < 9 ? 8 : 14, 0, 0, 0);
    s.dueItems.push({
      id: `due-${i}`,
      organizationId: id,
      title: [
        "Walk-in Fridge temperature",
        "Opening checklist",
        "Food preparation surfaces",
        "Main Freezer temperature",
        "Allergen information check",
        "Delivery check",
        "Display Fridge temperature",
        "Handwash station check",
        "Hot Hold Station temperature",
        "Afternoon fridge check",
        "Cleaning checklist",
        "Closing checklist",
      ][i],
      siteId: "main",
      equipmentId: i === 0 ? "walk-in" : "",
      templateVersionId: i === 1 ? "template-0-v1" : "",
      dueAt: time.toISOString(),
      assignedTo: i % 2 ? "Mia Chen" : "James Wilson",
      status: i < 9 ? "Done" : i === 9 ? "Overdue" : "Due",
      completedAt: i < 9 ? time.toISOString() : null,
    });
  }
  s.suppliers = [
    {
      id: "supplier-1",
      organizationId: id,
      name: "Bristol Fresh Produce",
      email: "orders@example.test",
      phone: "0117 000 0101",
      categories: "Fruit & vegetables",
      notes: "Delivers Monday, Wednesday and Friday.",
    },
    {
      id: "supplier-2",
      organizationId: id,
      name: "Meadow Dairy",
      email: "dairy@example.test",
      phone: "0117 000 0102",
      categories: "Dairy & eggs",
      notes: "Morning delivery before 09:00.",
    },
  ];
  s.notifications = [
    {
      id: "notice-1",
      organizationId: id,
      title: "Display Fridge needs attention",
      body: "8.2 °C recorded against a maximum of 5 °C.",
      type: "Out-of-range reading",
      createdAt: bad.serverTimestamp,
      readBy: [],
      href: "/app/issues",
    },
  ];
  s.auditEvents = [
    {
      id: "audit-seed",
      organizationId: id,
      actor: "Probe",
      at: new Date().toISOString(),
      action: "demo.created",
      entity: id,
      oldValue: "",
      newValue: "Demo workspace created",
      metadata: { demo: "true" },
    },
  ];
  return s;
}
