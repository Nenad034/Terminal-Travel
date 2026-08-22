import { existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';

// M19 spec §2.5 (v1.6, 22.8.2026) — lokalni disk API servera, dok hosting provajder za produkciju
// nije izabran (vlasnikova odluka preko AskUserQuestion). `process.cwd()` je `apps/api/` (isto
// polazište kao `prisma/seed/`), van git-a (vidi .gitignore).
export const ATTACHMENT_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'chat');

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB — razuman podrazumevan limit, podesivo kasnije

// Osnovna bezbednosna higijena — blokira izvršne/skript ekstenzije, ne pokušava potpunu listu
// dozvoljenih tipova (chat prima raznovrsne dokumente/slike, bela lista bi bila prestroga).
export const BLOCKED_ATTACHMENT_EXTENSIONS = ['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar', '.sh'];

export function ensureConversationUploadDir(conversationId: string): string {
  const dir = join(ATTACHMENT_UPLOAD_ROOT, conversationId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function sanitizeAttachmentFileName(originalName: string): string {
  return basename(originalName).replace(/[^\w.\- ]/g, '_');
}
