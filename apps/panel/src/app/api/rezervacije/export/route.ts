import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';

// Dopuna (23.8.2026, na zahtev vlasnika: "Omoguciti export liste rezervacija u excel ili gogle
// drive") — Excel deo urađen ovde, ista biblioteka/obrazac kao M15 BiTerminalAgent izveštaji
// (`apps/api/.../bi-terminal/report-generator.ts`, `exceljs`, već potvrđeno u tehničkom steku
// 23.8.2026) — ne uvodi se nova zavisnost, samo se isti, već odobreni izbor koristi i ovde.
// Google Drive izvoz NAMERNO nije urađen — zahteva OAuth/Drive API kredencijale, nova stavka
// tehničkog steka (Master dokument poglavlje 6), čeka posebnu potvrdu vlasnika.
// `exceljs` je CJS paket bez pravog default eksporta (ista napomena kao report-generator.ts) —
// `import * as ExcelJS` je jedini oblik koji stvarno radi u runtime-u.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rezervacije');
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheet.columns = columns.map((key) => ({ header: key, key, width: 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rezervacije.xlsx"',
    },
  });
}
