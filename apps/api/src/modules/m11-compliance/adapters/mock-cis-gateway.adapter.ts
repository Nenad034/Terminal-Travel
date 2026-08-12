import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CisGatewayAdapter, CisRegisterRequest, CisRegisterResult, CisReleaseRequest } from './cis-gateway-adapter.interface';

// Mock dok tehnički ugovor sa CIS/YUTA ne bude potvrđen (§2.3, §7) — vraća sintetički broj
// registracije tako da ostatak toka (statusi, alarmi, audit log) može biti izgrađen i testiran
// bez čekanja na spoljni sistem, isti princip kao MockFiscalizationGatewayAdapter u M10.
@Injectable()
export class MockCisGatewayAdapter implements CisGatewayAdapter {
  async register(request: CisRegisterRequest): Promise<CisRegisterResult> {
    return { cisRegistrationNumber: `MOCK-CIS-${request.bookingNumber}-${randomUUID()}` };
  }

  async release(_request: CisReleaseRequest): Promise<void> {
    // no-op — mock potvrđuje skidanje opterećenja bez stvarnog poziva
  }
}
