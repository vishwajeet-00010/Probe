import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Entry, Report } from "@/types/domain";
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function entriesCsv(entries: Entry[]) {
  return [
    [
      "ID",
      "Server time",
      "Device time",
      "Type",
      "Site",
      "Equipment/template",
      "Original value",
      "Status",
      "Staff",
      "Notes",
      "Amendments",
    ]
      .map(csvCell)
      .join(","),
    ...entries.map((e) =>
      [
        e.id,
        e.serverTimestamp,
        e.deviceTimestamp,
        e.type,
        e.siteId,
        e.label,
        e.value,
        e.status,
        e.staff,
        e.notes,
        JSON.stringify(e.amendments),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export async function reportPdf(report: Report) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]),
    y = 790;
  const safe = (s: string) => s.replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ");
  const line = (text: string, size = 10, heading = false) => {
    const max = Math.floor(490 / (size * 0.53));
    const words = safe(text).split(" ");
    let row = "";
    const draw = (s: string) => {
      if (y < 65) {
        page = pdf.addPage([595, 842]);
        y = 790;
      }
      page.drawText(s, {
        x: 48,
        y,
        size,
        font: heading ? bold : font,
        color: rgb(0.12, 0.22, 0.18),
      });
      y -= size + 8;
    };
    for (const word of words) {
      if ((row + word).length > max) {
        draw(row);
        row = "";
      }
      row += word + " ";
    }
    draw(row);
  };
  line("PROBE / INSPECTION PACK", 11, true);
  line(report.businessName, 25, true);
  line(report.address);
  line(`Registration: ${report.registrationId || "Not provided"}`);
  line(`Period: ${report.start} to ${report.end}`);
  line(`Report ID: ${report.id}`);
  line(`Generated: ${report.generatedAt} by ${report.generatedBy}`);
  if (report.watermarked) line("SAMPLE REPORT / FREE PLAN", 15, true);
  line("Operational records, not a legal compliance certification.", 10);
  y -= 12;
  line(
    `${report.entries.length} records | ${report.issues.length} related issues`,
    14,
    true,
  );
  for (const e of report.entries) {
    line(
      `${e.serverTimestamp.slice(0, 16).replace("T", " ")} | ${e.type} | ${e.label}`,
      11,
      true,
    );
    line(`${e.value} / ${e.status} / ${e.staff}`);
    if (e.notes) line(e.notes);
    for (const a of e.amendments)
      line(`Amendment ${a.at}: ${a.value}. Reason: ${a.reason}. By ${a.actor}`);
    if (e.timingFlag) line("Device timestamp requires review.");
  }
  line("Issues and corrective actions", 16, true);
  for (const i of report.issues) {
    line(`${i.title} / ${i.severity} / ${i.status}`, 11, true);
    for (const t of i.timeline)
      line(`${t.at.slice(0, 16)} ${t.actor}: ${t.note}`);
  }
  line("Sign-off", 16, true);
  line("Name: __________________   Signature: __________________");
  line("Date: __________________");
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(
      `Probe | ${report.id.slice(0, 8)} | ${i + 1} / ${pages.length}`,
      { x: 48, y: 30, size: 8, font },
    ),
  );
  return pdf.save();
}
