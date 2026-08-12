// M10 spec §6, §6.3, §12 — tačan tehnički ugovor sa SEF v4.0.0 i sa izabranim sertifikovanim
// ESIR/fiskalnim rešenjem NIJE deo specifikacije (potvrda knjigovođe/zvanične SEF dokumentacije
// potrebna neposredno pre implementacije ovog dela — CLAUDE.md "Šta ne raditi"). Ovaj interfejs
// namerno ostaje generički (isti obrazac kao PaymentGatewayAdapter, §7.1) — pravi SEF/ESIR poziv
// dolazi kao zaseban adapter kad tehnički ugovor bude potvrđen, bez izmene ostatka sistema.

import type { FiscalDocumentType } from '@prisma/client';

export interface FiscalizationSubmitRequest {
  documentType: FiscalDocumentType;
  amountRsd: number; // para
  vatAmount: number; // para
  buyerName: string;
  buyerTaxId: string | null;
}

export interface FiscalizationSubmitResult {
  externalReference: string; // broj fakture (SEF) ili fiskalni broj/QR (ESIR) — pravno merodavan identifikator
  xmlUrl: string | null;
  pdfUrl: string | null;
}

export interface FiscalizationGatewayAdapter {
  submitDocument(request: FiscalizationSubmitRequest): Promise<FiscalizationSubmitResult>;
}
