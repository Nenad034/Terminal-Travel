import { Injectable } from '@nestjs/common';
import { PresenceStatusValue } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

// M19 spec §2.4 — ONLINE/AWAY/OFFLINE, ažurirano isključivo iz ChatGateway (connect/disconnect/
// eksplicitan `presence.away` signal), nikad kroz sopstveni POST endpoint (spec §8 nema takav).
// ConversationsService.createMessage takođe čita ovu tabelu da odluči da li je primalac trenutno
// "povezan" pre nego što odluči da li treba M9 push (status !== ONLINE => tretira se kao offline).
@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.presenceStatus.findMany();
  }

  async setStatus(userId: string, status: PresenceStatusValue) {
    return this.prisma.presenceStatus.upsert({
      where: { userId },
      update: { status, lastSeenAt: new Date() },
      create: { userId, status, lastSeenAt: new Date() },
    });
  }
}
