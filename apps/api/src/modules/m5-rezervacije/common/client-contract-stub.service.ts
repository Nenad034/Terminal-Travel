import { Injectable } from '@nestjs/common';

/**
 * M5 spec §6, "Dodatni uslov za tip_nastupanja = ORGANIZATOR" (dopuna M20 specifikacije
 * §3.3) — vaučer se ne generiše (ni automatski ni preko override-a) dok M20 `ClientContract`
 * ne postoji bar u statusu GENERATED. M20 (Ugovori sa klijentima) još nije implementiran
 * (vidi tt-m20-ugovori-klijenti skill) — isti obrazac kao ComplianceStubsService: no-op
 * stub koji dokumentuje tačku gde će se M20 zakačiti. Trenutno UVEK vraća false, pa ovaj
 * uslov nikad ne prolazi za ORGANIZATOR rezervacije dok M20 ne postoji — namerno konzervativno
 * (sprečava izdavanje vaučera bez ugovora, ne obrnuto), u skladu sa "šta ne raditi" (CLAUDE.md).
 */
@Injectable()
export class ClientContractStubService {
  // TODO(M20): zameniti stvarnom proverom `ClientContract.status IN (GENERATED, SIGNED, ...)`
  // za dati bookingId, čim M20 bude specificiran i implementiran.
  async hasGeneratedContract(_bookingId: string): Promise<boolean> {
    return false;
  }
}
