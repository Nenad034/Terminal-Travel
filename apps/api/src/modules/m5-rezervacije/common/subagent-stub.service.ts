import { Injectable } from '@nestjs/common';
import { SubagentsService } from '../../m7-b2b-subagenti/subagents/subagents.service';
import { SubagentVolumeStatusService } from '../../m7-b2b-subagenti/commission/subagent-volume-status.service';

/**
 * M7 spec §4/§5/§6.2 — in-process most M5 → M7 (isti obrazac kao LoyaltyStubService → M6,
 * ComplianceStubsService → M11 TravelGuaranteeService). Jedino mesto u M5 koje zna za M7
 * Subagent entitet — zamenjuje TODO(M7) stubove koji su postojali pre nego što je M7
 * implementiran (avgust 2026).
 */
@Injectable()
export class SubagentStubService {
  constructor(
    private readonly subagents: SubagentsService,
    private readonly volumeStatus: SubagentVolumeStatusService,
  ) {}

  // M5 spec §6.2 dopuna — User.linked_profile_id za SUBAGENT_CONTACT JESTE Subagent.id (vidi
  // common/auth/resolve-caller-identity.ts), ali Quote/Booking.client_account_id očekuje pravi
  // M6 ClientAccount.id — ovo mapira jedno u drugo.
  async resolveClientAccountIdForSubagentContact(subagentId: string): Promise<string | null> {
    const subagent = await this.subagents.findById(subagentId);
    return subagent?.clientAccountId ?? null;
  }

  // M7 spec §5 — vraća effective_commission_percentage AKO postoji Subagent zapis za taj
  // client_account_id, inače null (M5 tada pada na M6 loyalty-status, §5 — "ne po
  // account_type, po POSTOJANJU Subagent zapisa").
  async getEffectiveCommissionPercentageForClientAccount(clientAccountId: string): Promise<number | null> {
    const subagent = await this.subagents.findByClientAccountId(clientAccountId);
    if (!subagent) return null;
    return this.volumeStatus.getEffectiveCommissionPercentage(subagent.id);
  }

  // M7 spec §4 — "current_outstanding_balance + Quote.total_price <= Subagent.credit_limit",
  // proveravano PRE bilo kog M3/M4 poziva (M5 spec §4 korak 1b, fiksan redosled posle §4 korak 1a).
  async checkCreditLimitIfSubagent(params: {
    clientAccountId: string;
    additionalAmount: number;
    currency: string;
  }): Promise<{ isSubagent: false; allowed: true } | { isSubagent: true; allowed: boolean; withinCreditLimit: boolean }> {
    const subagent = await this.subagents.findByClientAccountId(params.clientAccountId);
    if (!subagent) return { isSubagent: false, allowed: true };

    if (subagent.status !== 'ACTIVE' || subagent.creditLimit == null) {
      return { isSubagent: true, allowed: false, withinCreditLimit: false };
    }

    const outstanding = await this.subagents.outstandingBalance(subagent.id);
    // Mehanička dopuna (isti princip kao SubagentsService.outstandingBalance) — FX konverzija
    // između valuta nije definisana ovom specifikacijom; iznos nove rezervacije se sabira
    // nominalno bez obzira na currency parametar.
    const projected = outstanding.amount + params.additionalAmount;
    const withinLimit = projected <= Number(subagent.creditLimit);
    return { isSubagent: true, allowed: withinLimit, withinCreditLimit: withinLimit };
  }

  // M7 spec §2.0.2 korak 6 / M5 spec §6.3 — sistemski izuzetak izdavanja vaučera: subagent
  // ACTIVE i TRENUTNO (posle kreiranja rezervacije) unutar odobrenog kredita.
  async isActiveSubagentWithinCreditLimit(clientAccountId: string): Promise<boolean> {
    const subagent = await this.subagents.findByClientAccountId(clientAccountId);
    if (!subagent || subagent.status !== 'ACTIVE' || subagent.creditLimit == null) return false;
    const outstanding = await this.subagents.outstandingBalance(subagent.id);
    return outstanding.amount <= Number(subagent.creditLimit);
  }
}
