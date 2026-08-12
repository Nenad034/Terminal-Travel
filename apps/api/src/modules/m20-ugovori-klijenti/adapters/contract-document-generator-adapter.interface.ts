// M20 spec §8 — "tačan izgled/template ugovora po contract_type" je namerno van obima
// specifikacije (dizajnersko/pravno pitanje), a stvaran PDF/EU cloud-skladište zahteva izbor
// konkretne biblioteke koji tek treba potvrditi sa vlasnikom (CLAUDE.md — nema nove tehnologije
// bez potvrde). Ovaj interfejs namerno ostaje generički (isti obrazac kao
// FiscalizationGatewayAdapter u M10 i CisGatewayAdapter u M11) — pravi generator dolazi kao
// zaseban adapter kad izbor biblioteke bude potvrđen, bez izmene ostatka sistema. Do tada
// se ceo sadržaj ugovora ipak stvarno sastavlja i čuva (ClientContract.content_snapshot),
// samo je finalni PDF mock.

export interface ContractDocumentGenerateRequest {
  contractType: string;
  contentSnapshot: Record<string, unknown>;
}

export interface ContractDocumentGenerateResult {
  documentUrl: string;
}

export interface ContractDocumentGeneratorAdapter {
  generate(request: ContractDocumentGenerateRequest): Promise<ContractDocumentGenerateResult>;
}
