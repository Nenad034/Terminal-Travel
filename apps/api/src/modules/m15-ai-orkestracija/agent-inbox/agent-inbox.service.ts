import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';

// M15 spec §6 v1.10 — "Glavni agent agregira sve PROPOSE_THEN_APPROVE stavke [koje] čekaju"
// u jedan prikaz. Čisto čitanje iz postojećih tabela (nikad nova poslovna logika) — svaki
// izvor se upituje SAMO ako pozivalac ima odgovarajuću postojeću VIEW dozvolu tog modula
// (isti in-process princip kao M17 dashboard: "čitanje iz postojećih endpoint-a više modula").
// Ograničeno na izvore koji imaju STVARAN endpoint sa AgentActionGuard-om (poglavlje 5 dopuna,
// v1.10) — M3 pricelist_import.approve_row, M5 supplier_manifest.send, M7 commission_rebate.apply,
// M12 content.approve_publish, M14 ticket_response.send_with_price_or_obligation. Akcije bez
// postojećeg endpoint-a (M6 communication.send, M7 subagent_chat.*, M3 release_warning) nemaju
// "čeka odobrenje" red da se prikaže — dodaju se ovde tek kad taj endpoint bude izgrađen.
export interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

@Injectable()
export class AgentInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async get(userId: string): Promise<AgentInboxSource[]> {
    const sources: AgentInboxSource[] = [];

    if (await this.permissions.hasPermission(userId, 'M3', 'pricelist-import', 'VIEW')) {
      const count = await this.prisma.pricelistImportRow.count({ where: { reviewStatus: 'PENDING' } });
      sources.push({ moduleCode: 'M3', actionCode: 'pricelist_import.approve_row', label: 'Stavke cenovnika na čekanju odobrenja', count });
    }

    if (await this.permissions.hasPermission(userId, 'M5', 'supplier-manifest', 'VIEW')) {
      const count = await this.prisma.supplierManifest.count({ where: { status: 'DRAFT' } });
      sources.push({ moduleCode: 'M5', actionCode: 'supplier_manifest.send', label: 'Operativne liste spremne za slanje dobavljaču', count });
    }

    if (await this.permissions.hasPermission(userId, 'M7', 'commission-rebate', 'VIEW')) {
      const count = await this.prisma.commissionRebate.count({ where: { status: 'DRAFT' } });
      sources.push({ moduleCode: 'M7', actionCode: 'commission_rebate.apply', label: 'Rabati provizije na čekanju odobrenja', count });
    }

    if (await this.permissions.hasPermission(userId, 'M12', 'content', 'VIEW')) {
      const count = await this.prisma.contentPiece.count({ where: { status: 'PENDING_APPROVAL' } });
      sources.push({ moduleCode: 'M12', actionCode: 'content.approve_publish', label: 'Marketinški sadržaj na čekanju odobrenja', count });
    }

    if (await this.permissions.hasPermission(userId, 'M14', 'ticket', 'VIEW')) {
      const count = await this.prisma.ticketMessage.count({ where: { senderType: 'AI_DRAFT', sentBy: null } });
      sources.push({ moduleCode: 'M14', actionCode: 'ticket_response.send_with_price_or_obligation', label: 'Nacrti odgovora na čekanju slanja', count });
    }

    return sources;
  }
}
