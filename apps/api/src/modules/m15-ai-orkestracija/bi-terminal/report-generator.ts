// `exceljs`/`pdfkit` su CJS paketi bez pravog default eksporta — `import X from '...'` prolazi
// kroz tsc (TypeScript tipovi to dozvoljavaju) ali runtime baca "X is not a constructor"
// (otkriveno uživo testom, 23.8.2026) — `import X = require(...)` je jedini oblik koji stvarno
// radi u ovom (CommonJS) projektu.
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');

// M15 spec §6.9.3 dopuna (23.8.2026, na zahtev vlasnika: "omogucite kreiranje excel tabela,
// pdf i html izvestaja") — čisto prezentacioni sloj nad podacima koje BiTerminalAgent alati
// VEĆ vraćaju (§6.9.3 tabela) — ne novi izvor podataka, ne nova poslovna logika. Generiše se
// isključivo iz podataka koje je neki od postojećih read-only alata stvarno pročitao, isti
// "nikad ne izmišlja" princip kao ostatak agenta.
export interface ReportData {
  title: string;
  rows: Record<string, unknown>[];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function generateExcelBuffer(report: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(report.title.slice(0, 31) || 'Izveštaj');
  const columns = report.rows.length > 0 ? Object.keys(report.rows[0]) : [];
  sheet.columns = columns.map((key) => ({ header: key, key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of report.rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePdfBuffer(report: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(report.title, { underline: true });
    doc.moveDown();

    const columns = report.rows.length > 0 ? Object.keys(report.rows[0]) : [];
    if (columns.length === 0) {
      doc.fontSize(11).text('Nema podataka.');
      doc.end();
      return;
    }

    doc.fontSize(9);
    const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;
    let y = doc.y;
    columns.forEach((col, i) => {
      doc.text(col, doc.page.margins.left + i * colWidth, y, { width: colWidth, ellipsis: true });
    });
    y += 16;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
    y += 4;

    for (const row of report.rows) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      columns.forEach((col, i) => {
        doc.text(formatCell(row[col]), doc.page.margins.left + i * colWidth, y, { width: colWidth, ellipsis: true });
      });
      y += 16;
    }
    doc.end();
  });
}

export function generateHtmlString(report: ReportData): string {
  const columns = report.rows.length > 0 ? Object.keys(report.rows[0]) : [];
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headerRow = columns.map((c) => `<th>${escape(c)}</th>`).join('');
  const bodyRows = report.rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escape(formatCell(row[c]))}</td>`).join('')}</tr>`)
    .join('\n');
  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8" />
<title>${escape(report.title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; color: #202020; }
  h1 { font-size: 18px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f0f0f0; }
</style>
</head>
<body>
<h1>${escape(report.title)}</h1>
${columns.length === 0 ? '<p>Nema podataka.</p>' : `<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`}
</body>
</html>`;
}
