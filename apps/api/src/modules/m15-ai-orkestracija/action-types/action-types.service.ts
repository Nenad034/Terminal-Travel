import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateActionTypeDto } from './dto/create-action-type.dto';
import { UpdateActionTypeDto } from './dto/update-action-type.dto';

// M15 spec §4/§9 — CRUD nad registrom akcija koji AgentActionGuard čita uživo. "Registar se
// dopunjuje kad svaki budući modul uvede novu akciju... ne postoji podrazumevani nivo" —
// zato CREATE zahteva eksplicitan tier, nema default vrednosti.
@Injectable()
export class ActionTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agentActionType.findMany({ orderBy: [{ moduleCode: 'asc' }, { actionCode: 'asc' }] });
  }

  async create(dto: CreateActionTypeDto) {
    return this.prisma.agentActionType.create({
      data: {
        moduleCode: dto.moduleCode ?? null,
        actionCode: dto.actionCode,
        tier: dto.tier,
        sourceNote: dto.sourceNote,
      },
    });
  }

  async update(id: string, dto: UpdateActionTypeDto) {
    const existing = await this.prisma.agentActionType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`AgentActionType ${id} nije pronađen.`);
    return this.prisma.agentActionType.update({ where: { id }, data: dto });
  }
}
