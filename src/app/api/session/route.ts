import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { demoEnabled, signDemo } from "@/lib/auth";
import { initializeDemo, provisionOrganization } from "@/lib/database";
import { seedState } from "@/lib/seed";
import { firebaseAdmin } from "@/lib/firebase/admin";
import { failure, jsonBody, rateLimit, sameOrigin } from "@/lib/http";
import { DomainError } from "@/lib/permissions";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(`session:${req.headers.get("x-forwarded-for") ?? "local"}`, 15);
    const body = z
      .object({
        demo: z.boolean().optional(),
        idToken: z.string().max(10000).optional(),
        businessName: z.string().trim().min(1).max(200).optional(),
      })
      .parse(await jsonBody(req));
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 86400,
    };
    const jar = await cookies();
    if (body.demo) {
      if (!demoEnabled()) throw new DomainError("Demo mode is disabled.", 403);
      const organizationId = `demo-${randomUUID()}`;
      const token = signDemo({
        uid: "demo-owner",
        organizationId,
        name: "Alex Morgan",
        role: "Owner",
        demo: true,
        admin: false,
      });
      await initializeDemo(seedState(organizationId));
      jar.delete("probe_session");
      jar.set("probe_demo", token, options);
      return NextResponse.json({ redirect: "/app/dashboard" });
    }
    if (!body.idToken) throw new DomainError("Authentication token required.");
    const { auth } = firebaseAdmin();
    const claims = await auth.verifyIdToken(body.idToken, true);
    if (!claims.email_verified)
      throw new DomainError("Verify your email, then sign in again.", 403);
    if (Date.now() / 1000 - claims.auth_time > 300)
      throw new DomainError("Please sign in again.", 401);
    await provisionOrganization(
      claims.uid,
      claims.email ?? "",
      body.businessName ?? "Your business",
    );
    const session = await auth.createSessionCookie(body.idToken, {
      expiresIn: 86400000,
    });
    jar.delete("probe_demo");
    jar.set("probe_session", session, options);
    return NextResponse.json({ redirect: "/app/dashboard" });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const jar = await cookies();
    jar.delete("probe_session");
    jar.delete("probe_demo");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
