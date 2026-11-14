import { getActor } from "@/lib/auth";
import { entriesPage } from "@/lib/database";
import { authorize } from "@/lib/permissions";
import { entriesCsv } from "@/lib/reports";
import { failure } from "@/lib/http";
export async function GET() {
  try {
    const actor = await getActor();
    authorize(actor, "reports");
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let cursor: string | undefined,
          first = true;
        try {
          do {
            const p = await entriesPage(actor, { cursor, limit: 100 });
            const csv = entriesCsv(p.items);
            controller.enqueue(
              encoder.encode(
                (first ? "\ufeff" : "\r\n") +
                  (first ? csv : csv.split("\r\n").slice(1).join("\r\n")),
              ),
            );
            first = false;
            cursor = p.nextCursor ?? undefined;
          } while (cursor);
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="probe-all-records.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
