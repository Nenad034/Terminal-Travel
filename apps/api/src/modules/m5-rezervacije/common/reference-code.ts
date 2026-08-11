import { PrismaClient } from '@prisma/client';

// M5 spec §8.8 — "svaki SupplierManifest i svaki SupplierChangeNotice dobija reference_code
// pri kreiranju nacrta — format TT-NNNNNN (šestocifren, sekvencijalan, jedinstven kroz oba tipa)."
export function generateReferenceCode(sequence: number): string {
  return `TT-${String(sequence).padStart(6, '0')}`;
}

// Sekvenca je jedinstvena KROZ OBA TIPA (SupplierManifest + SupplierChangeNotice) — §8.8.
// Isti obrazac kao generateBookingNumber (broji postojeće + ponovni pokušaj na sudar).
export async function nextReferenceCode(prisma: PrismaClient | any): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [manifestCount, noticeCount] = await Promise.all([
      prisma.supplierManifest.count({ where: { referenceCode: { not: null } } }),
      prisma.supplierChangeNotice.count(),
    ]);
    const candidate = generateReferenceCode(manifestCount + noticeCount + 1 + attempt);
    const [existsManifest, existsNotice] = await Promise.all([
      prisma.supplierManifest.findUnique({ where: { referenceCode: candidate } }),
      prisma.supplierChangeNotice.findUnique({ where: { referenceCode: candidate } }),
    ]);
    if (!existsManifest && !existsNotice) return candidate;
  }
  throw new Error('Nije moguće generisati jedinstven reference_code, pokušajte ponovo.');
}
