import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateClientAccountDto } from './dto/update-client-account.dto';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';

// M6 spec §2.1, §5 — Nalogodavac. Istorija putovanja se čita uživo iz M5 (§5), nikad ne
// duplira lokalno (princip "jedan izvor istine").
@Injectable()
export class ClientAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // M6 spec §7 dopuna — Gost (account_type GUEST) sme da vidi/menja isključivo
  // sopstveni nalog; ownClientAccountId = null znači "nema sopstveni nalog" (npr.
  // interno osoblje), u tom slučaju ownership provera nije primenjiva.
  private async ownAccountIdIfGuest(actorUserId: string | undefined): Promise<{ isGuest: boolean; ownAccountId: string | null }> {
    if (!actorUserId) return { isGuest: false, ownAccountId: null };
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    return { isGuest: identity.accountType === 'GUEST', ownAccountId: identity.ownProfileId };
  }

  async findMany(filter: { email?: string; taxId?: string }, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest) {
      const own = ownAccountId ? await this.prisma.clientAccount.findUnique({ where: { id: ownAccountId } }) : null;
      return own ? [own] : [];
    }
    return this.prisma.clientAccount.findMany({
      where: { email: filter.email, taxId: filter.taxId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest && id !== ownAccountId) throw new NotFoundException(`ClientAccount ${id} nije pronađen.`);

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
