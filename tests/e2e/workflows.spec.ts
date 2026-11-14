import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("protected routes, append-only capture, issues, tenant isolation and inspector revocation", async ({
  request,
  playwright,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        data: { demo: true },
        headers: { Origin: "https://foreign.test" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/session", {
        data: { demo: true },
        headers: { Origin: "http://localhost:3000" },
      })
    ).ok(),
  ).toBe(true);
  const headers = { Origin: "http://localhost:3000" };
  const before = await (await request.get("/api/state")).json();
  const id = randomUUID(),
    command = {
      action: "entry.create",
      id,
      siteId: "main",
      equipmentId: "walk-in",
      type: "Temperature",
      value: "12.4",
      notes: "Stock moved to backup refrigeration.",
      deviceTimestamp: new Date().toISOString(),
      failed: false,
    };
  expect(
    (await request.post("/api/commands", { data: command, headers })).ok(),
  ).toBe(true);
  expect(
    (await request.post("/api/commands", { data: command, headers })).ok(),
  ).toBe(true);
  const captured = await (await request.get("/api/state")).json();
  expect(
    captured.entries.filter((e: { id: string }) => e.id === id),
  ).toHaveLength(1);
  const entry = captured.entries.find((e: { id: string }) => e.id === id);
  expect(entry.status).toBe("Out of range");
  expect(entry.issueId).toBeTruthy();
  expect(
    (
      await request.post("/api/commands", {
        headers,
        data: {
          action: "entry.amend",
          id,
          value: "12.2 °C",
          reason: "Confirmed transcription with operator.",
        },
      })
    ).ok(),
  ).toBe(true);
  const amended = await (await request.get("/api/state")).json();
  expect(amended.entries.find((e: { id: string }) => e.id === id).value).toBe(
    "12.4 °C",
  );
  expect(
    amended.entries.find((e: { id: string }) => e.id === id).amendments,
  ).toHaveLength(1);
  for (const status of ["Resolved", "Verified"])
    expect(
      (
        await request.post("/api/commands", {
          headers,
          data: {
            action: "issue.transition",
            id: entry.issueId,
            status,
            note: "Repair and safe temperatures checked.",
          },
        })
      ).ok(),
    ).toBe(true);
  const date = new Date().toISOString().slice(0, 10);
  const reportResponse = await request.post("/api/reports", {
    headers,
    data: {
      name: "Smoke inspection pack",
      start: date,
      end: date,
      siteIds: ["main"],
      sections: ["Temperature records", "Corrective actions", "Sign-offs"],
    },
  });
  expect(reportResponse.ok()).toBe(true);
  const report = await reportResponse.json();
  const pdf = await request.get(`/api/reports/${report.id}`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const share = await (
    await request.post("/api/shares", {
      headers,
      data: { reportId: report.id, days: 1 },
    })
  ).json();
  const inspector = await playwright.request.newContext();
  expect(await (await inspector.get(share.url)).text()).toContain(
    "Green Table",
  );
  const foreign = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  await foreign.post("/api/session", { headers, data: { demo: true } });
  const foreignState = await (await foreign.get("/api/state")).json();
  expect(foreignState.organization.id).not.toBe(before.organization.id);
  expect((await foreign.get(`/api/reports/${report.id}`)).status()).toBe(404);
  expect(
    (
      await foreign.post("/api/commands", {
        headers,
        data: {
          action: "entry.amend",
          id,
          value: "0",
          reason: "Guessed another tenant entry.",
        },
      })
    ).status(),
  ).toBe(404);
  const state = await (await request.get("/api/state")).json();
  const link = state.shareLinks.find(
    (l: { reportId: string }) => l.reportId === report.id,
  );
  await request.delete("/api/shares", { headers, data: { id: link.id } });
  expect(await (await inspector.get(share.url)).text()).toContain(
    "This inspection link is unavailable",
  );
  expect(
    (await request.get("/api/export")).headers()["content-type"],
  ).toContain("text/csv");
  expect(
    (
      await request.get("/api/generator?business=Smoke%20Cafe&equipment=Fridge")
    ).headers()["content-type"],
  ).toBe("application/pdf");
  await inspector.dispose();
  await foreign.dispose();
});

test("dashboard, navigation, keyboard dialog and responsive layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await expect(
    page.getByRole("heading", { name: "A little clarity for your day." }),
  ).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("heading", { name: "Today at a glance" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/dashboard-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Add equipment", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("QA backup fridge");
  await page.getByLabel("Location", { exact: true }).fill("Prep kitchen");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "QA backup fridge" }),
  ).toBeVisible();
  for (const route of [
    "logs",
    "checklists",
    "issues",
    "reports",
    "suppliers",
    "team",
    "notifications",
    "settings/business",
    "audit",
    "onboarding",
  ]) {
    const response = await page.goto(`/app/${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("public routes and free downloads do not require sign-in", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/features",
    "/pricing",
    "/templates",
    "/templates/fridge-temperature-log",
    "/templates/freezer-temperature-log",
    "/templates/cleaning-checklist",
    "/guides",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
    "/generator",
    "/signup",
    "/forgot-password",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect((await page.goto("/admin"))?.status()).toBe(404);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
