import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommunicationLogDto } from './dto/create-communication-log.dto';

// M6 spec §4.1/§4.2 — nivo "Autonomno" za sažimanje/nacrt (drafted_by_ai=true); ali AI nacrt koji
// pominje cenu/obavezu ne sme biti poslat bez ljudskog pregleda — sprovedeno tako da sent_by
// NIKAD ne bude popunjeno pri kreiranju dok je draftedByAi=true, čak i ako je prosleđeno.
@Injectable()
export class CommunicationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filter: { clientAccountId?: string; guestProfileId?: string }) {
    return this.prisma.communicationLog.findMany({
      where: { clientAccountId: filter.clientAccountId, guestProfileId: filter.guestProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCommunicationLogDto) {
    if (!dto.clientAccountId && !dto.guestProfileId) {
      throw new BadRequestException('Bar jedno od clientAccountId/guestProfileId mora biti popunjeno.');
    }
    const draftedByAi = dto.draftedByAi ?? false;

    return this.prisma.communicationLog.create({
      data: {
        clientAccountId: dto.clientAccountId ?? null,
        guestProfileId: dto.guestProfileId ?? null,
        channel: dto.channel,
        direction: dto.direction,
        category: dto.category ?? 'MARKETING',
        summary: dto.summary,
        draftedByAi,
        sentBy: draftedByAi ? null : (dto.sentBy ?? null),
      },
    });
  }

  // §4.1 — jedini put kroz koji AI-generisan nacrt dobija sent_by, uvek ljudski nalog.
  async markSent(id: string, actor: { userId: string }) {
    const log = await this.prisma.communicationLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`CommunicationLog ${id} nije pronađen.`);
    if (log.sentBy) throw new BadRequestException(`CommunicationLog ${id} je već označen kao poslat.`);

    return this.prisma.communicationLog.update({ where: { id }, data: { sentBy: actor.userId } });
  }
}
