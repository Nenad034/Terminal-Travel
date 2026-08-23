import { existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';

// M12 spec §2.5 (23.8.2026) — isti obrazac kao M19 `attachment-storage.ts`: lokalni disk API
// servera dok hosting provajder za produkciju nije izabran (vlasnikova odluka preko
// `AskUserQuestion`). `process.cwd()` je `apps/api/`, van git-a (vidi .gitignore).
export const CONTENT_MEDIA_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'marketing');

// Video (reels) mogu biti znatno veći od chat priloga (M19 koristi 20MB) — 100MB razuman
// podrazumevan limit za kratke video klipove, podesivo kasnije.
export const MAX_CONTENT_MEDIA_BYTES = 100 * 1024 * 1024;

// BELA lista (za razliku od M19 crne liste izvršnih ekstenzija) — marketing medija ima tačno
// dve svrhe (slika/video), nema razloga da prihvata bilo šta van toga.
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

export function resolveContentMediaType(mimeType: string): 'IMAGE' | 'VIDEO' | null {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return null;
}

export function isAllowedContentMediaMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export function ensureContentMediaUploadDir(contentPieceId: string): string {
  const dir = join(CONTENT_MEDIA_UPLOAD_ROOT, contentPieceId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function sanitizeContentMediaFileName(originalName: string): string {
  return basename(originalName).replace(/[^\w.\- ]/g, '_');
}
