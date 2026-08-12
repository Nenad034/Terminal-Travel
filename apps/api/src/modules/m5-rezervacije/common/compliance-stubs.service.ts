import { Injectable } from '@nestjs/common';
import { TravelGuaranteeService } from '../../m11-compliance/travel-guarantee/travel-guarantee.service';

/**
 * M5 spec §4, korak 1 — provera garancije putovanja (M11) i kreditnog limita (M7) MORA
 * ići u ovom fiksnom redosledu (garancija pa kredit) pre bilo kog poziva ka M3/M4. M11 je
 * implementiran (avgust 2026) i pozvan in-process ispod (isti obrazac kao M10 PaymentsService
 * → M5 BookingsService) — konceptualni API ugovor iz M11 spec §5 (`GET
 * /travel-guarantee/utilization`) je ostvaren kroz direktan DI poziv, ne HTTP. M7 (B2B modul)
 * još nije implementiran (vidi tt-m7-b2b-subagenti skill) — taj hook ostaje no-op stub dok
 * M7 ne dođe na red. Ne izmišljati M7 API pre toga (CLAUDE.md — "šta ne raditi").
 */
@Injectable()
export class ComplianceStubsService {
  constructor(private readonly travelGuarantee: TravelGuaranteeService) {}

  // M5 spec §4 korak 1a — "ako je tip_nastupanja = ORGANIZATOR, pozovi M11
  // GET /travel-guarantee/utilization — prekoračenje limita garancije odbija potvrdu."
  async checkTravelGuaranteeUtilization(params: { bookingTotalPrice: number; currency: string }): Promise<{ allowed: boolean; reason?: string }> {
    return this.travelGuarantee.assessForBooking(params);
  }

  // TODO(M7): M5 spec §4 korak 1b — "ako Quote.client_account_id pripada Subagentu (M7
  // §2.1), proveri kreditni limit (M7 §4) — prekoračenje odbija potvrdu." M7 (B2B modul)
  // još nije implementiran (vidi tt-m7-b2b-subagenti skill) — dok ne postoji, ova provera
  // uvek vraća "nije subagent" (isBookingForSubagent=false), pa se granа kreditnog limita
  // nikad ne primenjuje. Kad M7 postoji, ovo se zamenjuje stvarnom proverom Subagent zapisa.
  async checkCreditLimitIfSubagent(_params: {
    clientAccountId: string;
    additionalAmount: number;
    currency: string;
  }): Promise<{ isSubagent: false; allowed: true } | { isSubagent: true; allowed: boolean; withinCreditLimit: boolean }> {
    return { isSubagent: false, allowed: true };
  }

  // TODO(M7): M5 spec §6.3 — "sistemski izuzetak izdavanja vaučera — subagent unutar
  // odobrenog kredita." Dok M7 Subagent entitet ne postoji, ovo uvek vraća false (nijedan
  // klijent nije prepoznat kao ACTIVE Subagent unutar limita), pa se automatski izuzetak
  // nikad ne primenjuje — vaučer i dalje čeka payment_status=PAID ili ručni override (§6).
  async isActiveSubagentWithinCreditLimit(_clientAccountId: string): Promise<boolean> {
    return false;
  }
}
