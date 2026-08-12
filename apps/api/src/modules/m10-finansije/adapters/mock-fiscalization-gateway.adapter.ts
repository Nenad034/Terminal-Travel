import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  FiscalizationGatewayAdapter,
  FiscalizationSubmitRequest,
  FiscalizationSubmitResult,
} from './fiscalization-gateway-adapter.interface';

// Mock dok tehnički ugovor sa SEF/ESIR ne bude potvrđen (§6.3, §12) — vraća sintetičku
// referencu tako da ostatak toka (statusi, deadline, audit log) može biti izgrađen i testiran
// bez čekanja na spoljni sistem, isti princip kao MockProviderAdapter u M4.
@Injectable()
export class MockFiscalizationGatewayAdapter implements FiscalizationGatewayAdapter {
  async submitDocument(request: FiscalizationSubmitRequest): Promise<FiscalizationSubmitResult> {
    const prefix = request.documentType === 'SEF_EFAKTURA' ? 'SEF' : request.documentType === 'ESIR_RACUN' ? 'ESIR' : 'KO';
    const externalReference = `MOCK-${prefix}-${randomUUID()}`;
    return { externalReference, xmlUrl: `mock://fiscal/${externalReference}.xml`, pdfUrl: `mock://fiscal/${externalReference}.pdf` };
  }
}
