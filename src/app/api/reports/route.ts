import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { reportSchema } from "@/lib/validation";
import { generateReport } from "@/services/reports";
import { failure, jsonBody, rateLimit, sameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await getActor();
    rateLimit(`reports:${actor.uid}`, 5);
    const report = await generateReport(
      actor,
      reportSchema.parse(await jsonBody(req)),
    );
    return NextResponse.json({ id: report.id });
  } catch (e) {
    return failure(e);
  }
}
