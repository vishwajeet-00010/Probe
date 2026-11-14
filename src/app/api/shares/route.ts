import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { mutate } from "@/lib/database";
import { authorize, tenantRecord } from "@/lib/permissions";
import { failure, jsonBody, sameOrigin } from "@/lib/http";
import { createShare } from "@/services/reports";
import { audit } from "@/services/commands";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await getActor();
    const body = z
      .object({
        reportId: z.string().uuid(),
        days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
      })
      .parse(await jsonBody(req));
    const token = await createShare(actor, body.reportId, body.days);
    return NextResponse.json({
      url: `${process.env.APP_URL ?? new URL(req.url).origin}/inspect/${token}`,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await getActor();
    authorize(a, "share");
    const body = z
      .object({ id: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(await jsonBody(req));
    await mutate(
      a,
      (s) => {
        tenantRecord(a, s.shareLinks, body.id).revoked = true;
        audit(s, a, "share.revoked", body.id, null, true);
      },
      [{ collection: "shareLinks", id: body.id }],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
