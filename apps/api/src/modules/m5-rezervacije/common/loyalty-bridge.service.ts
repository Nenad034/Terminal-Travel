import { Injectable } from '@nestjs/common';
import { ClientLoyaltyStatusService } from '../../m6-crm/loyalty/client-loyalty-status.service';

/**
 * M6 spec §3.3 — "M5 poziva GET /loyalty-status/:clientAccountId u trenutku kreiranja Quote i
 * primenjuje popust pre prikaza konačne cene." In-process poziv (isti obrazac kao
 * ComplianceBridgeService → M11 TravelGuaranteeService, ClientContractBridgeService → M20).
 */
@Injectable()
export class LoyaltyBridgeService {
  constructor(private readonly loyaltyStatus: ClientLoyaltyStatusService) {}

  async getDiscountPercentage(clientAccountId: string): Promise<number> {
    const status = await this.loyaltyStatus.get(clientAccountId);
    return Number(status.discountPercentage ?? 0);
  }
}
