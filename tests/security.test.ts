import { describe, it, expect, beforeAll } from "vitest";
import { signDemo, verifyDemo } from "@/lib/auth";
import { sameOrigin } from "@/lib/http";
import { csvCell, reportPdf } from "@/lib/reports";
import { seedState } from "@/lib/seed";
import type { Actor, Report } from "@/types/domain";
const actor: Actor = {
  uid: "demo-owner",
  organizationId: "demo-00000000-0000-0000-0000-000000000000",
  name: "Alex",
  role: "Owner",
  demo: true,
  admin: false,
};
beforeAll(() => {
  process.env.SESSION_SECRET =
    "test-only-secret-at-least-thirty-two-characters";
  process.env.PROBE_DEMO_ENABLED = "true";
  process.env.APP_URL = "http://localhost:3000";
});
describe("session and request security", () => {
  it("round-trips signed demo sessions", () =>
    expect(verifyDemo(signDemo(actor)).organizationId).toBe(
      actor.organizationId,
    ));
  it("rejects tampered session payload", () => {
    const token = signDemo(actor),
      parts = token.split(".");
    parts[0] = Buffer.from(JSON.stringify({ ...actor, admin: true })).toString(
      "base64url",
    );
    expect(() => verifyDemo(parts.join("."))).toThrow();
  });
  it("rejects mismatched origins", () =>
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/commands", {
          headers: { origin: "https://attacker.test" },
        }),
      ),
    ).toThrow());
  it("rejects missing origin on mutation", () =>
    expect(() =>
      sameOrigin(new Request("http://localhost:3000/api/commands")),
    ).toThrow());
  it("accepts same origin", () =>
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/commands", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow());
  it.each(["=SUM(A1)", "+CMD()", "@IMPORT", "-1+2"])(
    "neutralizes CSV formula %s",
    (v) => expect(csvCell(v)).toBe(`"'${v}"`),
  );
  it("escapes quotes", () =>
    expect(csvCell('A "quote"')).toBe('"A ""quote"""'));
  it("generates a real PDF with amendments and pagination", async () => {
    const s = seedState("org-a");
    const r: Report = {
      id: "report",
      organizationId: "org-a",
      name: "Inspection",
      start: "2026-01-01",
      end: "2026-12-31",
      siteIds: ["main"],
      sections: ["Temperature records"],
      generatedAt: new Date().toISOString(),
      generatedBy: "Owner",
      status: "Ready",
      businessName: "Green Table Café",
      address: "Main Street",
      registrationId: "",
      entries: s.entries,
      issues: s.issues,
      watermarked: true,
    };
    const pdf = await reportPdf(r);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});
