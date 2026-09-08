import { closeSync, existsSync, mkdirSync, openSync, readSync } from 'fs';
import { basename, join } from 'path';

// M19 spec §2.5 (v1.6, 22.8.2026) — lokalni disk API servera, dok hosting provajder za produkciju
// nije izabran (vlasnikova odluka preko AskUserQuestion). `process.cwd()` je `apps/api/` (isto
// polazište kao `prisma/seed/`), van git-a (vidi .gitignore).
export const ATTACHMENT_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'chat');

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB — razuman podrazumevan limit, podesivo kasnije

// Bezbednosna analiza (dok. 36 §3 tačka 4, 28.8.2026) — bila je BLOKIRAJUĆA lista (izvršne/skript
// ekstenzije), ne DOZVOLJENA: `.svg`/`.html` (mogu nositi izvršljiv sadržaj kad se otvore u
// pregledaču) su prolazili neometano jer nisu bili na toj listi. Sada je obrnuto — SAMO nabrojane
// ekstenzije prolaze. Ublaženo i pre ove izmene time što je M19 isključivo interni kanal i
// preuzimanje ide kroz `Content-Disposition: attachment` (prisiljava snimanje, ne otvaranje u
// pregledaču, v. `conversations.controller.ts` downloadAttachment) — ovo je odbrana u dubinu,
// ne zamena za to.
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.zip',
];

// Potpis (prvih par bajtova) za ekstenzije koje imaju pouzdan, stabilan format — otkriva pokušaj
// da se opasan sadržaj sakrije iza dozvoljene ekstenzije (npr. HTML fajl preimenovan u
// "slika.png"). `.txt`/`.csv`/stariji binarni Office formati (`.doc`/`.xls`/`.ppt`) nemaju
// dovoljno specifičan/proveren potpis ovde — namerno izostavljeni, allowlist iznad je njihova
// jedina ograda.
const MAGIC_BYTES: Record<string, Buffer[]> = {
  '.pdf': [Buffer.from('%PDF')],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.gif': [Buffer.from('GIF8')],
  // .docx/.xlsx/.pptx su ZIP kontejneri (Office Open XML) — isti potpis kao .zip.
  '.zip': [Buffer.from([0x50, 0x4b])],
  '.docx': [Buffer.from([0x50, 0x4b])],
  '.xlsx': [Buffer.from([0x50, 0x4b])],
  '.pptx': [Buffer.from([0x50, 0x4b])],
};

/** `true` i kad ekstenzija nema poznat potpis (namerno — allowlist je tada jedina ograda). Čita
 * samo prvih 8 bajtova (deskriptor, ne ceo fajl u memoriju — prilog sme biti do 20 MB). */
export function matchesMagicBytes(ext: string, filePath: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return true;
  const fd = openSync(filePath, 'r');
  const header = Buffer.alloc(8);
  try {
    readSync(fd, header, 0, 8, 0);
  } finally {
    closeSync(fd);
  }
  return signatures.some((sig) => header.subarray(0, sig.length).equals(sig));
}

export function ensureConversationUploadDir(conversationId: string): string {
  const dir = join(ATTACHMENT_UPLOAD_ROOT, conversationId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function sanitizeAttachmentFileName(originalName: string): string {
  return basename(originalName).replace(/[^\w.\- ]/g, '_');
}
