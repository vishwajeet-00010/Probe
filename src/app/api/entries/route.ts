import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { entriesPage } from "@/lib/database";
import { authorize } from "@/lib/permissions";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const actor = await getActor();
    authorize(actor, "read");
    const p = new URL(req.url).searchParams;
    return NextResponse.json(
      await entriesPage(actor, {
        cursor: p.get("cursor") ?? undefined,
        start: p.get("start") ?? undefined,
        end: p.get("end") ?? undefined,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
