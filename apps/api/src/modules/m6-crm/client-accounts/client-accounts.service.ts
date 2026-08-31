import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateClientAccountDto } from './dto/update-client-account.dto';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';

// M6 spec §2.1, §5 — Nalogodavac. Istorija putovanja se čita uživo iz M5 (§5), nikad ne
// duplira lokalno (princip "jedan izvor istine").
@Injectable()
export class ClientAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  // M6 spec §7 dopuna — Gost (account_type GUEST) sme da vidi/menja isključivo
  // sopstveni nalog; ownClientAccountId = null znači "nema sopstveni nalog" (npr.
  // interno osoblje), u tom slučaju ownership provera nije primenjiva.
  private async ownAccountIdIfGuest(actorUserId: string | undefined): Promise<{ isGuest: boolean; ownAccountId: string | null }> {
    if (!actorUserId) return { isGuest: false, ownAccountId: null };
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    return { isGuest: identity.accountType === 'GUEST', ownAccountId: identity.ownProfileId };
  }

  // M6 spec §7 dopuna (31.8.2026, M1 §3.9a konvencija) — STAFF bez `M6/client-account/VIEW_ALL`
  // vidi samo naloge koji imaju bar jednu rezervaciju (M5 Booking) čiji je vlasnik ili zadužen.
  // ClientAccount namerno nema DB FK ka Booking (schema.prisma napomena), pa se ovo radi u dva
  // koraka umesto ugnježdenog Prisma filtera (isti obrazac kao M5 §6.6, samo bez relacije).
  private async ownClientAccountIdsForStaffScope(actorUserId: string): Promise<string[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { OR: [{ ownerId: actorUserId }, { assignedToId: actorUserId }] },
      select: { clientAccountId: true },
      distinct: ['clientAccountId'],
    });
    return bookings.map((b) => b.clientAccountId);
  }

  async findMany(filter: { email?: string; taxId?: string }, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest) {
      const own = ownAccountId ? await this.prisma.clientAccount.findUnique({ where: { id: ownAccountId } }) : null;
      return own ? [own] : [];
    }

    let scopedIds: string[] | undefined;
    if (actorUserId) {
      const hasViewAll = await this.permissions.hasPermission(actorUserId, 'M6', 'client-account', 'VIEW_ALL');
      if (!hasViewAll) scopedIds = await this.ownClientAccountIdsForStaffScope(actorUserId);
    }

    return this.prisma.clientAccount.findMany({
      where: { email: filter.email, taxId: filter.taxId, id: scopedIds ? { in: scopedIds } : undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest && id !== ownAccountId) throw new NotFoundException(`ClientAccount ${id} nije pronađen.`);

    if (!isGuest && actorUserId) {
      const hasViewAll = await this.permissions.hasPermission(actorUserId, 'M6', 'client-account', 'VIEW_ALL');
      if (!hasViewAll) {
        const scopedIds = await this.ownClientAccountIdsForStaffScope(actorUserId);
        if (!scopedIds.includes(id)) throw new NotFoundException(`ClientAccount ${id} nije pronađen.`);
      }
    }

    const account = await this.prisma.clientAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`ClientAccount ${id} nije pronađen.`);
    return account;
  }

  async create(dto: CreateClientAccountDto) {
    return this.prisma.clientAccount.create({
      data: {
        accountType: dto.accountType,
        fullName: dto.fullName ?? null,
        companyName: dto.companyName ?? null,
        taxId: dto.taxId ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        country: dto.country ?? null,
        preferredLanguage: (dto.preferredLanguage as any) ?? null,
        marketingConsent: dto.marketingConsent ?? false,
        marketingConsentDate: dto.marketingConsent ? new Date() : null,
        tags: dto.tags ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateClientAccountDto, actorUserId?: string) {
    const existing = await this.findOne(id, actorUserId);
    const consentChangedToTrue = dto.marketingConsent === true && existing.marketingConsent !== true;

    return this.prisma.clientAccount.update({
      where: { id },
      data: {
        accountType: dto.accountType,
        fullName: dto.fullName,
        companyName: dto.companyName,
        taxId: dto.taxId,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        country: dto.country,
        preferredLanguage: dto.preferredLanguage as any,
        marketingConsent: dto.marketingConsent,
        marketingConsentDate: consentChangedToTrue ? new Date() : undefined,
        tags: dto.tags as any,
      },
    });
  }

  // M12 spec §4 (dopuna avgust 2026) — kandidati za EMAIL distribucioni kanal: uvek
  // marketing_consent=true (M6 spec §7, Zakon o zaštiti podataka o ličnosti), dodatno suženo na
  // presek sa targetTags kad je popunjeno (nikad prošireno van marketing_consent=true skupa).
  // Koristi ga M12 EmailDistributionAdapter preko DI, isti obrazac kao ostali cross-modul pozivi.
  async findMarketingRecipients(targetTags?: string[] | null) {
    const consented = await this.prisma.clientAccount.findMany({
      where: { marketingConsent: true, email: { not: null } },
    });
    if (!targetTags || targetTags.length === 0) return consented;

    return consented.filter((account) => {
      const accountTags = Array.isArray(account.tags) ? (account.tags as unknown[]).map(String) : [];
      return targetTags.some((tag) => accountTags.includes(tag));
    });
  }

  // §5 — GET /client-accounts/:id/travel-history: spaja M5 Booking/BookingItem uživo, uz proveru
  // da nalogodavac zaista postoji (404 ako ne).
  async travelHistory(id: string, actorUserId?: string) {
    await this.findOne(id, actorUserId);
    return this.prisma.booking.findMany({
      where: { clientAccountId: id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
