import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Actor } from "@/types/domain";
import { firebaseAdmin } from "./firebase/admin";
import { DomainError } from "./permissions";
export const demoEnabled = () => process.env.PROBE_DEMO_ENABLED === "true";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new DomainError(
      "Configure SESSION_SECRET with at least 32 characters.",
      503,
    );
  return s;
}
export function signDemo(actor: Actor) {
  const payload = Buffer.from(
    JSON.stringify({ ...actor, exp: Date.now() + 86400000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyDemo(token: string): Actor {
  if (!demoEnabled()) throw new DomainError("Demo mode is disabled.", 401);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new DomainError("Invalid session.", 401);
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new DomainError("Invalid session.", 401);
  const a = JSON.parse(
    Buffer.from(payload, "base64url").toString(),
  ) as Actor & { exp: number };
  if (a.exp < Date.now() || !a.demo || !a.organizationId.startsWith("demo-"))
    throw new DomainError("Session expired.", 401);
  return a;
}
export async function getActor(): Promise<Actor> {
  const jar = await cookies();
  const demo = jar.get("probe_demo")?.value;
  if (demo) return verifyDemo(demo);
  const session = jar.get("probe_session")?.value;
  if (!session) throw new DomainError("Please sign in to continue.", 401);
  const { auth, db } = firebaseAdmin();
  let claims;
  try {
    claims = await auth.verifySessionCookie(session, true);
  } catch {
    throw new DomainError("Your session expired. Please sign in.", 401);
  }
  if (!claims.email_verified)
    throw new DomainError("Verify your email before continuing.", 403);
  const profile = await db.collection("users").doc(claims.uid).get();
  const organizationId = profile.get("organizationId") as string;
  if (!organizationId)
    throw new DomainError("Complete account setup first.", 403);
  const member = await db
    .collection("organizations")
    .doc(organizationId)
    .collection("memberships")
    .doc(claims.uid)
    .get();
  if (!member.exists || member.get("status") !== "Active")
    throw new DomainError("Membership is inactive.", 403);
  return {
    uid: claims.uid,
    organizationId,
    name: String(member.get("name")),
    role: member.get("role"),
    demo: false,
    admin: claims.internalAdmin === true,
  };
}
