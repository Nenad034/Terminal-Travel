import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';

// M6 spec §2.2, §5 — Gost. Istorija putovanja se čita uživo iz M5 preko BookingItemGuest.
@Injectable()
export class GuestProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filter: { linkedClientAccountId?: string }) {
    return this.prisma.guestProfile.findMany({
      where: { linkedClientAccountId: filter.linkedClientAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.guestProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException(`GuestProfile ${id} nije pronađen.`);
    return profile;
  }

  async create(dto: CreateGuestProfileDto) {
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
        linkedClientAccountId: dto.linkedClientAccountId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateGuestProfileDto) {
    await this.findOne(id);
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
  async travelHistory(id: string) {
    await this.findOne(id);
    const links = await this.prisma.bookingItemGuest.findMany({
      where: { guestProfileId: id },
      include: { bookingItem: { include: { product: true, booking: true } } },
    });
    return links.map((l) => l.bookingItem);
  }
}
