import { getActor } from "@/lib/auth";
import { readRecord } from "@/lib/database";
import { authorize } from "@/lib/permissions";
import { reportPdf } from "@/lib/reports";
import { failure } from "@/lib/http";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor();
    authorize(actor, "reports");
    const { id } = await params;
    const report = await readRecord(actor, "reports", id);
    const pdf = await reportPdf(report);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="probe-${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
