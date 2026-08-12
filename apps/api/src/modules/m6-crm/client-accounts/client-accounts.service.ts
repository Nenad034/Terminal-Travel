import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateClientAccountDto } from './dto/update-client-account.dto';

// M6 spec §2.1, §5 — Nalogodavac. Istorija putovanja se čita uživo iz M5 (§5), nikad ne
// duplira lokalno (princip "jedan izvor istine").
@Injectable()
export class ClientAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filter: { email?: string; taxId?: string }) {
    return this.prisma.clientAccount.findMany({
      where: { email: filter.email, taxId: filter.taxId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
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

  async update(id: string, dto: UpdateClientAccountDto) {
    const existing = await this.findOne(id);
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
  async travelHistory(id: string) {
    await this.findOne(id);
    return this.prisma.booking.findMany({
      where: { clientAccountId: id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
