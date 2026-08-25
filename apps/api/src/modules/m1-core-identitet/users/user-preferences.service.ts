import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// M1 spec §3.9 — generičko ključ-vrednost skladište ličnih UI podešavanja po korisniku. Nema
// RBAC iznad "ovo je moj sopstveni nalog" (spec §3.9) — svaki korisnik čita/piše isključivo svoje,
// zato userId dolazi iz JWT-a (CurrentUser), nikad iz parametra rute.
@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.userPreference.findMany({ where: { userId } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(userId: string, key: string, value: unknown) {
    await this.prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value: value as object },
      create: { userId, key, value: value as object },
    });
    return { key, value };
  }
}
