import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'path';
import * as ExcelJS from 'exceljs';

// M15 spec §6.5.4.3 dopuna v1.43 (25.8.2026, na zahtev vlasnika — "kada se klikne na +
// omogucite unos nekog fajla koji zelimo da unesemo kao kontekst") — TRANZIENTNO izvlačenje
// teksta iz priloženog dokumenta, poziva se iz OmnisearchController pre nego što se bafer
// odbaci (nikad se ne piše na disk, isti princip kao razlog za `memoryStorage` u kontroleru).
// Tipovi/biblioteke potvrđene kroz AskUserQuestion: word/pdf/excel/html/txt. Excel čita VEĆ
// postojeći `exceljs` (v1.30, generate_report) — nema nove zavisnosti za taj format.
const PLAIN_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

@Injectable()
export class ExtractFileService {
  async extractText(buffer: Buffer, originalName: string): Promise<{ text: string }> {
    const ext = extname(originalName).toLowerCase();

    if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
      return { text: buffer.toString('utf-8') };
    }
    if (ext === '.html' || ext === '.htm') {
      return { text: stripHtml(buffer.toString('utf-8')) };
    }
    if (ext === '.pdf') {
      return { text: await extractPdf(buffer) };
    }
    if (ext === '.docx') {
      return { text: await extractDocx(buffer) };
    }
    if (ext === '.xlsx') {
      return { text: await extractXlsx(buffer) };
    }
    if (ext === '.doc' || ext === '.xls') {
      throw new BadRequestException(
        `Stari format "${ext}" nije podržan — sačuvaj fajl kao ${ext === '.doc' ? '.docx' : '.xlsx'} pa pokušaj ponovo.`,
      );
    }
    throw new BadRequestException(
      `Tip fajla "${ext || '(bez ekstenzije)'}" nije podržan za prilog u AI chat.`,
    );
  }
}

// Skidanje tagova bez nove zavisnosti — dovoljno za "izvuci tekst da agent može da ga pročita",
// ne mora biti savršen HTML-to-text (isti "dovoljno dobro za prvi prolaz" princip kao ostatak
// dokumenta). <script>/<style> sadržaj se briše CEO (ne samo tag), inače bi kod/CSS ušao u tekst.
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Prevod JEDNE ćelije u tekst.
 *
 * ISPRAVKA 10.9.2026, izmerena nad stvarnim cenovnicima u `Primeri cenovnika/`: prethodna
 * verzija je radila `String(v)`, a ExcelJS za veći deo ćelija NE vraća primitivnu vrednost nego
 * objekat — pa je `String(v)` davao doslovno `[object Object]`. U 7 od 9 stvarnih Excel
 * cenovnika bilo je tako pokvareno između 3% i **52%** svih ćelija.
 *
 * Nije bila kozmetika, jer je gubilo tačno ono što nosi značenje:
 *  - `richText` — naziv hotela sa kategorijom („Argisht Palace Aparthotel 3+*") i crveno
 *    istaknuta upozorenja („CHANGE: The Rates are NOT Valid on Czech Market!");
 *  - `formula`/`sharedFormula` sa `result` — **izračunate cene**, dakle sam podatak zbog kog
 *    se cenovnik i uvozi.
 *
 * Greška se nije videla kao greška: model bi dobio `[object Object]` tamo gde stoji cena, pa
 * bi red ili preskočio ili popunio pretpostavkom.
 *
 * Izmereno posle ispravke: od 50.177 pokvarenih ćelija vraćeno 50.174; preostale tri su
 * formule bez izračunatog rezultata, gde je prazno tačan odgovor.
 */
function celijaUTekst(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== 'object') return String(v);
  const o = v as Record<string, unknown>;
  if (Array.isArray(o.richText)) {
    return (o.richText as { text?: string }[]).map((d) => d?.text ?? '').join('');
  }
  // `result` pokriva i `formula` i `sharedFormula` — zanima nas izračunata vrednost, ne izraz.
  if ('result' in o) return celijaUTekst(o.result);
  if ('text' in o) return celijaUTekst(o.text);
  if ('hyperlink' in o) return String(o.hyperlink);
  if ('error' in o) return String(o.error);
  return '';
}

// Svaki list postaje "list <naziv>" naslov + redovi razdvojeni tabom (dovoljno da agent vidi
// vrednosti po koloni, ne pokušava savršen tabelarni prikaz u čistom tekstu).
async function extractXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    parts.push(`List "${sheet.name}":`);
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map(celijaUTekst);
      parts.push(cells.join('\t'));
    });
  });
  return parts.join('\n');
}
