import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { readState, clientSnapshot } from "@/lib/database";
import { authorize } from "@/lib/permissions";
import { failure } from "@/lib/http";
export async function GET() {
  try {
    const actor = await getActor();
    authorize(actor, "read");
    return NextResponse.json(clientSnapshot(await readState(actor)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
