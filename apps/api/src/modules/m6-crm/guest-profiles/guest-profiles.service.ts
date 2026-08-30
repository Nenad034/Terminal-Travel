import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';

// M6 spec §2.2, §5, §7 dopuna — Gost. Istorija putovanja se čita uživo iz M5 preko
// BookingItemGuest. Gost (account_type GUEST) sme da vidi/menja/pravi isključivo
// profile povezane preko linked_client_account_id na sopstveni ClientAccount.
@Injectable()
export class GuestProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownAccountIdIfGuest(actorUserId: string | undefined): Promise<{ isGuest: boolean; ownAccountId: string | null }> {
    if (!actorUserId) return { isGuest: false, ownAccountId: null };
    const identity = await resolveCallerIdentity(this.prisma, actorUserId);
    return { isGuest: identity.accountType === 'GUEST', ownAccountId: identity.ownProfileId };
  }

  async findMany(filter: { linkedClientAccountId?: string }, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    return this.prisma.guestProfile.findMany({
      where: { linkedClientAccountId: isGuest ? (ownAccountId ?? undefined) : filter.linkedClientAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actorUserId?: string) {
    const profile = await this.prisma.guestProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException(`GuestProfile ${id} nije pronađen.`);

    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest && profile.linkedClientAccountId !== ownAccountId) {
      throw new NotFoundException(`GuestProfile ${id} nije pronađen.`);
    }
    return profile;
  }

  async create(dto: CreateGuestProfileDto, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    if (isGuest && dto.linkedClientAccountId && dto.linkedClientAccountId !== ownAccountId) {
      // Gost sme da pravi profile samo za sebe — sprečava da poveže tuđi ClientAccount.
      throw new ForbiddenException('Gost sme da kreira profil isključivo za sopstveni nalog.');
    }
    return this.prisma.guestProfile.create({
      data: {
        fullName: dto.fullName,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        nationality: dto.nationality,
        dateOfBirth: new Date(dto.dateOfBirth),
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        preferences: (dto.preferences as any) ?? undefined,
        linkedClientAccountId: isGuest ? (dto.linkedClientAccountId ?? ownAccountId) : (dto.linkedClientAccountId ?? null),
      },
    });
  }

  async update(id: string, dto: UpdateGuestProfileDto, actorUserId?: string) {
    const { isGuest, ownAccountId } = await this.ownAccountIdIfGuest(actorUserId);
    // `findOne` proverava SAMO da profil TRENUTNO pripada pozivaocu — ne sprečava da ovaj
    // poziv, u istom telu, prebaci taj isti profil na TUĐ nalog (`linkedClientAccountId` je
    // izmenjivo polje, UpdateGuestProfileDto). Nalaz (30.8.2026, Faza 8 IDOR pregled —
    // docs/analize/34-FAZA8-BEZBEDNOSNI-PREGLED.md): `create()` iznad je ovo već sprečavao,
    // `update()` nije — ista provera, ovde nedostajala.
    if (isGuest && dto.linkedClientAccountId && dto.linkedClientAccountId !== ownAccountId) {
      throw new ForbiddenException('Gost sme da poveže profil isključivo sa sopstvenim nalogom.');
    }
    await this.findOne(id, actorUserId);
    return this.prisma.guestProfile.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        nationality: dto.nationality,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        email: dto.email,
        phone: dto.phone,
        preferences: dto.preferences as any,
        linkedClientAccountId: dto.linkedClientAccountId,
      },
    });
  }

  // §5 — GET /guest-profiles/:id/travel-history: spaja preko BookingItemGuest.guest_profile_id.
  async travelHistory(id: string, actorUserId?: string) {
    await this.findOne(id, actorUserId);
    const links = await this.prisma.bookingItemGuest.findMany({
      where: { guestProfileId: id },
      include: { bookingItem: { include: { product: true, booking: true } } },
    });
    return links.map((l) => l.bookingItem);
  }
}
