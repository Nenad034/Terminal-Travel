import { Injectable } from '@nestjs/common';
import { CommissionRebate } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FiscalDocumentsService } from '../../m10-finansije/fiscal-documents/fiscal-documents.service';
import { ClientAccountsService } from '../../m6-crm/client-accounts/client-accounts.service';

/**
 * M7 spec §3.2 / M10 spec §5.1a — in-process most M7 → M10 (isti obrazac kao SubagentStubService
 * → M5, LoyaltyStubService → M6). Jedino mesto u M7 koje zna za M10 FiscalDocumentsService.
 *
 * Smer zavisnosti: M7 CommissionModule uvozi M10 FiscalDocumentsModule (ne obrnuto) — M10 nikad
 * ne uvozi M7 direktno, da ne bi napravio kružnu zavisnost sa M10→M7 vezom iz drugog smera
 * (kad je KNJIZNO_ODOBRENJE poslat, M10 obaveštava M7 preko Event Bus-a, ne DI poziva — vidi
 * FiscalDocumentsService.submit() i M7EventSubscribersService).
 *
 * NAMERNO koristi PrismaService direktno za čitanje Subagent-a, umesto SubagentsService — isti
 * razlog kao CommissionAuthorityService (SubagentsModule već uvozi CommissionModule, obrnuta
 * zavisnost ka SubagentsService bi napravila kružnu zavisnost unutar M7).
 */
@Injectable()
export class FiscalDocumentStubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalDocuments: FiscalDocumentsService,
    private readonly clientAccounts: ClientAccountsService,
  ) {}

  // Poziva se iz CommissionRebatesService.approve() čim rabat pređe u APPROVED (M7 spec §3.2:
  // "knjiži se kao umanjenje sledeće fakture/dugovanja subagenta u M10") — sinhrono, isti in-process
  // DI obrazac kao ostali stub servisi u ovoj bazi koda (ne asinhroni event, za ovaj smer).
  async prepareCreditNoteDraftForRebate(rebate: CommissionRebate): Promise<void> {
    const subagent = await this.prisma.subagent.findUnique({ where: { id: rebate.subagentId } });
    // Weak reference (M10 spec §5.1a) — Subagent bi trebalo uvek da postoji za validan rebate,
    // ali ne blokiramo APPROVED prelaz zbog nedosledne referentne celovitosti (isti opreza princip
    // kao ostali stub servisi koji ne bacaju grešku na nedostajuću weak-referencu).
    if (!subagent) return;

    // M6 ClientAccount.company_name (weak reference preko Subagent.client_account_id) — stvarno
    // ime firme za buyer_name_snapshot, sad kad M6/M7 oba postoje (M10 spec §5.1a dopuna, avgust 2026).
    const account = await this.clientAccounts.findOne(subagent.clientAccountId).catch(() => null);
    const buyerNameSnapshot = account?.companyName ?? account?.fullName ?? '';

    await this.fiscalDocuments.prepareCreditNoteDraft({
      relatedSubagentId: rebate.subagentId,
      creditedRebateId: rebate.id,
      amount: Number(rebate.calculatedAmount),
      currency: rebate.currency,
      buyerNameSnapshot,
    });
  }
}
