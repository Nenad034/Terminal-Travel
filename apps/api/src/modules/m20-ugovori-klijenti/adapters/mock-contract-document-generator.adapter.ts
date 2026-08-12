import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ContractDocumentGenerateRequest,
  ContractDocumentGenerateResult,
  ContractDocumentGeneratorAdapter,
} from './contract-document-generator-adapter.interface';

// Mock dok PDF biblioteka/EU cloud skladište ne budu potvrđeni (§8) — vraća sintetički URL tako
// da ostatak toka (statusi, revizije, audit log) može biti izgrađen i testiran bez čekanja,
// isti princip kao MockFiscalizationGatewayAdapter (M10) i MockCisGatewayAdapter (M11).
@Injectable()
export class MockContractDocumentGeneratorAdapter implements ContractDocumentGeneratorAdapter {
  async generate(request: ContractDocumentGenerateRequest): Promise<ContractDocumentGenerateResult> {
    return { documentUrl: `mock://client-contracts/${request.contractType}-${randomUUID()}.pdf` };
  }
}
