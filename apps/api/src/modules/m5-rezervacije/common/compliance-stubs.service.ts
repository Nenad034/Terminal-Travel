import { Injectable } from '@nestjs/common';

/**
 * M5 spec §4, korak 1 — provera garancije putovanja (M11) i kreditnog limita (M7) MORA
 * ići u ovom fiksnom redosledu (garancija pa kredit) pre bilo kog poziva ka M3/M4. Ni M11
 * ni M7 još ne postoje kao implementirani moduli — ovaj servis je TODO stub/no-op koji
 * dokumentuje tačku gde će se ta dva modula zakačiti kad dođu na red (isti obrazac kao
 * "meka zavisnost" M5→M22 opisana u Master dokumentu). Trenutno oba hook-a UVEK prolaze
 * (ne blokiraju nijednu potvrdu rezervacije) — zamenjuje se stvarnim pozivom ka M11
 * `GET /travel-guarantee/utilization` i M7 kreditnom limitu kad ti moduli budu specificirani
 * i implementirani. Ne izmišljati njihov API pre toga (CLAUDE.md — "šta ne raditi").
 */
@Injectable()
export class ComplianceStubsService {
  // TODO(M11): M5 spec §4 korak 1a — "ako je tip_nastupanja = ORGANIZATOR, pozovi M11
  // GET /travel-guarantee/utilization — prekoračenje limita garancije odbija potvrdu."
  // M11 (Regulatorni modul / Compliance) još nije implementiran (vidi tt-m11-compliance
  // skill) — dok ne postoji, ova provera je no-op koja uvek dozvoljava potvrdu.
  async checkTravelGuaranteeUtilization(_params: { bookingTotalPrice: number; currency: string }): Promise<{ allowed: true }> {
    return { allowed: true };
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
