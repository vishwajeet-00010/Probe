import { test, expect } from "@playwright/test";

// Public, no-account surfaces of the static site. Signed-in workflows need a
// Firebase project or the Auth/Firestore emulators (see docs/DEPLOYMENT.md).

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
    "/login",
    "/forgot-password",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

test("printable generator downloads a PDF in the browser", async ({ page }) => {
  await page.goto("/generator?equipment=Walk-in%20fridge");
  await expect(page.getByRole("textbox", { name: /Equipment/ })).toHaveValue(
    "Walk-in fridge",
  );
  await page.getByRole("textbox", { name: "Business name" }).fill("Test Café");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate printable PDF" }).click();
  expect((await download).suggestedFilename()).toBe(
    "probe-food-safety-log.pdf",
  );
});

test("inspector view rejects a missing or malformed token", async ({
  page,
}) => {
  await page.goto("/inspect#not-a-token");
  await expect(
    page.getByRole("heading", { name: "This inspection link is unavailable." }),
  ).toBeVisible();
});
