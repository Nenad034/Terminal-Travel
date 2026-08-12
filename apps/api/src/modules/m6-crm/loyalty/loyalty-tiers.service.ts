import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';

// M6 spec §3.1 — definicije nivoa lojalnosti, EDIT ograničeno na Vlasnik/Direktor (§7).
@Injectable()
export class LoyaltyTiersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany() {
    return this.prisma.loyaltyTier.findMany({ orderBy: { rank: 'desc' } });
  }

  async findOne(id: string) {
    const tier = await this.prisma.loyaltyTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException(`LoyaltyTier ${id} nije pronađen.`);
    return tier;
  }

  async create(dto: CreateLoyaltyTierDto) {
    return this.prisma.loyaltyTier.create({ data: dto });
  }

  async update(id: string, dto: UpdateLoyaltyTierDto) {
    await this.findOne(id);
    return this.prisma.loyaltyTier.update({ where: { id }, data: dto });
  }
}
