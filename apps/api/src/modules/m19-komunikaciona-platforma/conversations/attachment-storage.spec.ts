import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  matchesMagicBytes,
  sanitizeAttachmentFileName,
} from './attachment-storage';

// Dok. 36 §3 tačka 4 (28.8.2026) — allowlist umesto blocklist, i magic-bytes provera protiv
// fajla čiji sadržaj ne odgovara prijavljenoj ekstenziji (npr. HTML sakriven kao "slika.png").
describe('attachment-storage (M19 dok. 36 §3 tačka 4)', () => {
  it('allowlist NE sadrži opasne ekstenzije koje su ranije prolazile kroz blocklist', () => {
    expect(ALLOWED_ATTACHMENT_EXTENSIONS).not.toContain('.svg');
    expect(ALLOWED_ATTACHMENT_EXTENSIONS).not.toContain('.html');
    expect(ALLOWED_ATTACHMENT_EXTENSIONS).not.toContain('.exe');
    expect(ALLOWED_ATTACHMENT_EXTENSIONS).not.toContain('.js');
  });

  it('allowlist i dalje sadrži uobičajene poslovne tipove', () => {
    for (const ext of ['.pdf', '.docx', '.xlsx', '.jpg', '.png', '.zip']) {
      expect(ALLOWED_ATTACHMENT_EXTENSIONS).toContain(ext);
    }
  });

  describe('matchesMagicBytes', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'tt-attach-'));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('prihvata pravi PDF (potpis %PDF)', () => {
      const p = join(dir, 'a.pdf');
      writeFileSync(p, Buffer.from('%PDF-1.4\n...'));
      expect(matchesMagicBytes('.pdf', p)).toBe(true);
    });

    it('odbija HTML sadržaj preimenovan u .png (nalaz 4 — obrnuta situacija od pre)', () => {
      const p = join(dir, 'slika.png');
      writeFileSync(p, Buffer.from('<html><body>ne slika</body></html>'));
      expect(matchesMagicBytes('.png', p)).toBe(false);
    });

    it('prihvata pravi PNG (potpis 0x89 PNG)', () => {
      const p = join(dir, 'b.png');
      writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      expect(matchesMagicBytes('.png', p)).toBe(true);
    });

    it('vraća true za ekstenzije bez poznatog potpisa (.txt) — allowlist je jedina ograda', () => {
      const p = join(dir, 'c.txt');
      writeFileSync(p, 'bilo sta');
      expect(matchesMagicBytes('.txt', p)).toBe(true);
    });
  });

  describe('sanitizeAttachmentFileName (postojeće ponašanje, nepromenjeno u ovom nalazu)', () => {
    it('uklanja putanju i neobične karaktere iz imena fajla', () => {
      expect(sanitizeAttachmentFileName('../../etc/passwd')).toBe('passwd');
    });
  });
});
