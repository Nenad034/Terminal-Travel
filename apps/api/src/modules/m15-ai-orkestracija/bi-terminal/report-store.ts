import { randomUUID } from 'crypto';

// M15 spec §6.9.3 dopuna — privremeno skladište generisanih izveštaja (Excel/PDF/HTML), u
// memoriji procesa, NE novi Prisma model — namerno malo/prolazno (nikad ne poslati, nikad
// preuzeti = 30 minuta pa nestaje), jer sam SADRŽAJ izveštaja (brojevi/redovi) već ide u
// audit log preko upita koji ga je proizveo (§6.9.4) — fajl je samo prezentacioni izvod tog
// već-audit-logovanog podatka, ne dodatni trajan zapis koji treba čuvati zauvek.
export interface StoredReport {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  createdBy: string;
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, StoredReport>();

export function saveReport(report: Omit<StoredReport, 'createdAt'>): string {
  const id = randomUUID();
  store.set(id, { ...report, createdAt: Date.now() });
  setTimeout(() => store.delete(id), TTL_MS).unref();
  return id;
}

export function getReport(id: string): StoredReport | undefined {
  const entry = store.get(id);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return entry;
}
