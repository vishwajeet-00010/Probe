import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Free printable log (no account). Generated entirely in the browser. */
export async function printableLogPdf(business: string, equipment: string) {
  const name = business.trim().slice(0, 120);
  const units = equipment
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (!name || !units.length)
    throw new Error("Add your business name and at least one item.");
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s: string) => s.replace(/[^\x20-\x7e -ÿ]/g, " ");
  for (const unit of units) {
    const page = pdf.addPage([842, 595]);
    page.drawText(safe(name), { x: 35, y: 550, size: 22, font: bold });
    page.drawText(safe(`Food-safety log / ${unit.slice(0, 90)}`), {
      x: 35,
      y: 517,
      size: 14,
      font,
    });
    page.drawText(
      "Period: __________________   Safe limits: __________________",
      { x: 35, y: 487, size: 11, font },
    );
    const cols = [35, 115, 195, 290, 380, 480, 807];
    [
      "Date",
      "Time",
      "Reading/result",
      "Initials",
      "Corrective action",
      "Review",
    ].forEach((t, i) =>
      page.drawText(t, { x: cols[i] + 6, y: 453, size: 10, font: bold }),
    );
    for (let row = 0; row <= 12; row++) {
      const y = 472 - row * 31;
      page.drawLine({
        start: { x: 35, y },
        end: { x: 807, y },
        color: rgb(0.7, 0.75, 0.7),
        thickness: 0.5,
      });
    }
    for (const x of cols)
      page.drawLine({
        start: { x, y: 472 },
        end: { x, y: 100 },
        color: rgb(0.7, 0.75, 0.7),
        thickness: 0.5,
      });
    page.drawText(
      "Probe / Free printable template. Adapt to your food-safety plan. Not a compliance certification.",
      { x: 35, y: 40, size: 9, font },
    );
  }
  return pdf.save();
}
