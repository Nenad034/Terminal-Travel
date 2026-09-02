import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika) — prosta referentna lista banaka za
// izbor pri unosu uplate (BANK_TRANSFER/CARD_MANUAL/CHECK). Popunjena u seed.ts, bez CRUD-a u
// ovom prolazu (nije traženo, `active` polje ostavlja prostor za meko gašenje kasnije).
@Injectable()
export class BanksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bank.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }
}
