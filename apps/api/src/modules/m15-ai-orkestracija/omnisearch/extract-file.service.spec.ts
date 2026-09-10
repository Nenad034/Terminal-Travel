import * as ExcelJS from 'exceljs';
import { ExtractFileService } from './extract-file.service';

/**
 * M15 §6.5.4.3 — izvlačenje teksta iz priloženog dokumenta.
 *
 * Testovi postoje zbog jednog konkretnog kvara nađenog 10.9.2026 pri merenju stvarnih Excel
 * cenovnika (`Primeri cenovnika/`): `String(cell)` je za veći deo ćelija davao doslovno
 * `[object Object]`, jer ExcelJS bogat tekst i formule vraća kao objekat. U 7 od 9 stvarnih
 * cenovnika bilo je pokvareno između 3% i 52% ćelija — uključujući izračunate cene.
 *
 * Greška se nije videla kao greška: ni jedan test, ni `tsc`, ni build je nisu hvatali, a model
 * bi na mestu cene dobio `[object Object]` i red preskočio ili popunio pretpostavkom. Zato ovi
 * testovi rade nad STVARNO napravljenim `.xlsx` baferom, ne nad izmišljenim objektom.
 */
describe('ExtractFileService — Excel (M15 §6.5.4.3)', () => {
  const service = new ExtractFileService();

  async function napraviXlsx(popuni: (sheet: ExcelJS.Worksheet) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Cenovnik');
    popuni(sheet);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it('bogat tekst (richText) se čita kao tekst, ne kao [object Object]', async () => {
    const buffer = await napraviXlsx((sheet) => {
      sheet.addRow([
        {
          richText: [{ text: 'Argisht Palace Aparthotel ' }, { font: { bold: true }, text: '3+*' }],
        },
      ]);
    });

    const { text } = await service.extractText(buffer, 'cenovnik.xlsx');

    expect(text).toContain('Argisht Palace Aparthotel 3+*');
    expect(text).not.toContain('[object Object]');
  });

  /**
   * Najskuplji oblik ovog kvara: cena je u Excel-u često rezultat formule. Stara verzija je na
   * mestu cene slala `[object Object]`, pa je red gubio upravo ono zbog čega postoji.
   */
  it('formula se čita kao IZRAČUNATA vrednost, ne kao izraz ni kao objekat', async () => {
    const buffer = await napraviXlsx((sheet) => {
      sheet.addRow(['DBL', { formula: 'B1*2', result: 8950 }]);
    });

    const { text } = await service.extractText(buffer, 'cenovnik.xlsx');

    expect(text).toContain('8950');
    expect(text).not.toContain('[object Object]');
    expect(text).not.toContain('B1*2');
  });

  it('hiperveza daje svoj vidljivi tekst', async () => {
    const buffer = await napraviXlsx((sheet) => {
      sheet.addRow([{ text: 'Uslovi 2026', hyperlink: 'https://primer.rs/uslovi' }]);
    });

    const { text } = await service.extractText(buffer, 'cenovnik.xlsx');

    expect(text).toContain('Uslovi 2026');
    expect(text).not.toContain('[object Object]');
  });

  it('obične vrednosti i prazne ćelije se ne menjaju', async () => {
    const buffer = await napraviXlsx((sheet) => {
      sheet.addRow(['DBL', null, 'BB', 8950]);
    });

    const { text } = await service.extractText(buffer, 'cenovnik.xlsx');

    expect(text).toContain('DBL');
    expect(text).toContain('BB');
    expect(text).toContain('8950');
  });

  it('stari binarni .xls se odbija sa uputstvom, ne tihim pokušajem', async () => {
    await expect(service.extractText(Buffer.from('x'), 'cenovnik.xls')).rejects.toThrow(/\.xlsx/);
  });
});
