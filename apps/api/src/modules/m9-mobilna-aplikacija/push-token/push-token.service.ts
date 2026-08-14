import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// M9 spec §5 v1.4 — registracija/osvežavanje Expo push tokena pozivaoca. Idempotentno:
// ponovljen isti token samo ponovo upisuje istu vrednost, ne pravi duplikat (jedno polje po User).
@Injectable()
export class PushTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, pushToken: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { pushToken } });
    return { ok: true };
  }
}
