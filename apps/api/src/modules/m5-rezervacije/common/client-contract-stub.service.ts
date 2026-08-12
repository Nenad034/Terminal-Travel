import { Injectable } from '@nestjs/common';
import { ClientContractsService } from '../../m20-ugovori-klijenti/client-contracts/client-contracts.service';

/**
 * M5 spec §6, "Dodatni uslov za tip_nastupanja = ORGANIZATOR" (dopuna M20 specifikacije
 * §3.3) — vaučer se ne generiše (ni automatski ni preko override-a) dok M20 `ClientContract`
 * ne postoji bar u statusu GENERATED. M20 implementiran avgust 2026 — in-process poziv (isti
 * obrazac kao ComplianceStubsService → M11 TravelGuaranteeService).
 */
@Injectable()
export class ClientContractStubService {
  constructor(private readonly clientContracts: ClientContractsService) {}

  async hasGeneratedContract(bookingId: string): Promise<boolean> {
    return this.clientContracts.hasGeneratedContract(bookingId);
  }
}
