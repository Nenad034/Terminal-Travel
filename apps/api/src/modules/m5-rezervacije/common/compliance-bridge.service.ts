import { Injectable } from '@nestjs/common';
import { TravelGuaranteeService } from '../../m11-compliance/travel-guarantee/travel-guarantee.service';
import { SubagentBridgeService } from './subagent-bridge.service';

/**
 * M5 spec §4, korak 1 — provera garancije putovanja (M11) i kreditnog limita (M7) MORA
 * ići u ovom fiksnom redosledu (garancija pa kredit) pre bilo kog poziva ka M3/M4. Oba modula
 * su implementirana (avgust 2026) i pozvana in-process ispod (isti obrazac kao M10
 * PaymentsService → M5 BookingsService) — konceptualni API ugovori (M11 spec §5, M7 spec §4)
 * su ostvareni kroz direktan DI poziv, ne HTTP. M7 delegira na SubagentBridgeService (isti folder)
 * — jedino mesto u ovom fajlu koje zna za M7 Subagent entitet.
 */
@Injectable()
export class ComplianceBridgeService {
  constructor(
    private readonly travelGuarantee: TravelGuaranteeService,
    private readonly subagentBridge: SubagentBridgeService,
  ) {}

  // M5 spec §4 korak 1a — "ako je tip_nastupanja = ORGANIZATOR, pozovi M11
  // GET /travel-guarantee/utilization — prekoračenje limita garancije odbija potvrdu."
  async checkTravelGuaranteeUtilization(params: { bookingTotalPrice: number; currency: string }): Promise<{ allowed: boolean; reason?: string }> {
    return this.travelGuarantee.assessForBooking(params);
  }

  // M5 spec §4 korak 1b — "ako Quote.client_account_id pripada Subagentu (M7 §2.1), proveri
  // kreditni limit (M7 §4) — prekoračenje odbija potvrdu."
  async checkCreditLimitIfSubagent(params: {
    clientAccountId: string;
    additionalAmount: number;
    currency: string;
  }): Promise<{ isSubagent: false; allowed: true } | { isSubagent: true; allowed: boolean; withinCreditLimit: boolean }> {
    return this.subagentBridge.checkCreditLimitIfSubagent(params);
  }

  // M5 spec §6.3 — "sistemski izuzetak izdavanja vaučera — subagent unutar odobrenog kredita."
  async isActiveSubagentWithinCreditLimit(clientAccountId: string): Promise<boolean> {
    return this.subagentBridge.isActiveSubagentWithinCreditLimit(clientAccountId);
  }
}
