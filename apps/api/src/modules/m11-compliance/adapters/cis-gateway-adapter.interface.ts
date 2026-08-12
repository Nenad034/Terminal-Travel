// M11 spec §2.3, §7 — tačan tehnički ugovor sa CIS/YUTA sistemom za registraciju garancije po
// rezervaciji i skidanje opterećenja pri stornu NIJE deo specifikacije (potvrda zvanične
// dokumentacije i, po potrebi, pravnika/YUTA potrebna pre implementacije — CLAUDE.md "Šta ne
// raditi"). Ovaj interfejs namerno ostaje generički (isti obrazac kao FiscalizationGatewayAdapter
// u M10) — pravi CIS poziv dolazi kao zaseban adapter kad tehnički ugovor bude potvrđen, bez
// izmene ostatka sistema.

export interface CisRegisterRequest {
  bookingId: string;
  bookingNumber: string;
  travelGuaranteeId: string;
  policyNumber: string;
}

export interface CisRegisterResult {
  cisRegistrationNumber: string;
}

export interface CisReleaseRequest {
  cisRegistrationNumber: string;
}

export interface CisGatewayAdapter {
  register(request: CisRegisterRequest): Promise<CisRegisterResult>;
  release(request: CisReleaseRequest): Promise<void>;
}
