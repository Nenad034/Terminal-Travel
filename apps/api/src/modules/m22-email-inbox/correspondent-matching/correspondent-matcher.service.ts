import { Injectable } from '@nestjs/common';
import { EmailCorrespondentType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CorrespondentMatch {
  correspondentType: EmailCorrespondentType;
  correspondentClientAccountId: string | null;
  correspondentSupplierId: string | null;
}

const NO_MATCH: CorrespondentMatch = { correspondentType: 'OTHER', correspondentClientAccountId: null, correspondentSupplierId: null };

// M22 spec §3.1 — "tačno poklapanje from_address prve INBOUND poruke naspram M6 GuestProfile.
// email/ClientAccount kontakt mejla (subagent) i M3 Supplier kontakt mejla — nivo Autonomno,
// čista deterministička provera, bez poziva jezičkom modelu." Redosled provere: GuestProfile →
// ClientAccount (SUBAGENT ako postoji Subagent zapis za taj nalog, inače GUEST) → Supplier
// (contactEmail ili SupplierContact.email) → OTHER bez poklapanja.
@Injectable()
export class CorrespondentMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async match(fromAddress: string): Promise<CorrespondentMatch> {
    const address = fromAddress.trim().toLowerCase();
    if (!address) return NO_MATCH;

    const guestProfile = await this.prisma.guestProfile.findFirst({ where: { email: { equals: address, mode: 'insensitive' } } });
    if (guestProfile) {
      return { correspondentType: 'GUEST', correspondentClientAccountId: guestProfile.linkedClientAccountId ?? null, correspondentSupplierId: null };
    }

    const clientAccount = await this.prisma.clientAccount.findFirst({ where: { email: { equals: address, mode: 'insensitive' } } });
    if (clientAccount) {
      const subagent = await this.prisma.subagent.findUnique({ where: { clientAccountId: clientAccount.id } });
      return {
        correspondentType: subagent ? 'SUBAGENT' : 'GUEST',
        correspondentClientAccountId: clientAccount.id,
        correspondentSupplierId: null,
      };
    }

    const supplierByContactEmail = await this.prisma.supplier.findFirst({ where: { contactEmail: { equals: address, mode: 'insensitive' } } });
    if (supplierByContactEmail) {
      return { correspondentType: 'SUPPLIER', correspondentClientAccountId: null, correspondentSupplierId: supplierByContactEmail.id };
    }

    const supplierContact = await this.prisma.supplierContact.findFirst({ where: { email: { equals: address, mode: 'insensitive' } } });
    if (supplierContact) {
      return { correspondentType: 'SUPPLIER', correspondentClientAccountId: null, correspondentSupplierId: supplierContact.supplierId };
    }

    return NO_MATCH;
  }
}
