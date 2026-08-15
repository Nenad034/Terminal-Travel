import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTrendSuggestionDto } from './dto/create-trend-suggestion.dto';

// M18 spec §5.1 — approve() menja isključivo status/approved_by u bazi. Ulazak u Dodatak A
// Master dokumenta ostaje ljudski uređivački korak van ovog sistema (§5 "Tok") — kod ovde
// namerno ne piše u .md fajlove.
@Injectable()
export class TrendSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.trendSuggestion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateTrendSuggestionDto) {
    return this.prisma.trendSuggestion.create({
      data: { category: dto.category, summary: dto.summary, suggestedAction: dto.suggestedAction, status: 'DRAFT' },
    });
  }

  async approve(id: string, actorId: string) {
    const existing = await this.findOneOrThrow(id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`TrendSuggestion ${id} je već u statusu ${existing.status} — samo DRAFT se može odobriti.`);
    }
    return this.prisma.trendSuggestion.update({ where: { id }, data: { status: 'APPROVED', approvedBy: actorId } });
  }

  async reject(id: string) {
    const existing = await this.findOneOrThrow(id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`TrendSuggestion ${id} je već u statusu ${existing.status} — samo DRAFT se može odbiti.`);
    }
    return this.prisma.trendSuggestion.update({ where: { id }, data: { status: 'REJECTED' } });
  }

  private async findOneOrThrow(id: string) {
    const existing = await this.prisma.trendSuggestion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`TrendSuggestion ${id} nije pronađen.`);
    return existing;
  }
}
