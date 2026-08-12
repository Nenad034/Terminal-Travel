import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';

// M10 spec §3.1 — kurs NBS na dan X, koristi se i za konverziju gostu (§3) i za obaveze
// prema dobavljaču (§8.1). source = MANUAL dok automatski NBS izvor ne bude povezan (§12).
@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExchangeRateDto, actor: { userId: string }) {
    return this.prisma.exchangeRateSnapshot.create({
      data: {
        currency: dto.currency,
        rateDate: new Date(dto.rateDate),
        nbsMiddleRate: dto.nbsMiddleRate,
        source: 'MANUAL',
      },
    });
  }

  async findAll(filters: { currency?: string }) {
    return this.prisma.exchangeRateSnapshot.findMany({
      where: { currency: filters.currency },
      orderBy: { rateDate: 'desc' },
      take: 200,
    });
  }

  // Vraća kurs za valutu na dan `date`, ili najbliži prethodni ako tačan dan ne postoji
  // (kurs se ne objavljuje vikendom/praznikom kod NBS, uobičajena praksa je poslednji važeći).
  async findForCurrencyOnOrBefore(currency: string, date: Date) {
    const snapshot = await this.prisma.exchangeRateSnapshot.findFirst({
      where: { currency, rateDate: { lte: date } },
      orderBy: { rateDate: 'desc' },
    });
    if (!snapshot) {
      throw new NotFoundException(
        `Nema unetog kursa za ${currency} na dan ${date.toISOString().slice(0, 10)} ili ranije (M10 spec §3.1).`,
      );
    }
    return snapshot;
  }
}
