import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type PaginationQueryDto, paginated, paginationArgs } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { NbsRateFetcherService } from './nbs-rate-fetcher.service';

// M10 spec §3.1 — kurs NBS na dan X, koristi se i za konverziju gostu (§3) i za obaveze
// prema dobavljaču (§8.1). source = NBS_API otkad postoji dnevni automatski uvoz (§11,
// avgust 2026, sa javne NBS stranice — privremeno dok zvanični SOAP servis ne bude potvrđen);
// MANUAL ostaje dostupno kao ručna korekcija/popuna.
@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nbsFetcher: NbsRateFetcherService,
  ) {}

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

  // STRANIČENJE (6.9.2026, dok. 39 nalaz 2.2). Ranije golo `take: 200`: kursna lista raste
  // jednim redom po valuti PO DANU, pa 200 pokriva manje od godinu dana za tri valute — a
  // pozivalac koji traži kurs iz prošle sezone dobio bi prazno bez ijedne poruke o tome.
  // `count` ide u istoj transakciji sa upitom da broj i redovi ne dođu iz dva trenutka.
  async findAll(filters: { currency?: string }, pagination?: PaginationQueryDto) {
    const where = { currency: filters.currency };
    const { skip, take, page, limit } = paginationArgs(pagination);
    const [redovi, total] = await this.prisma.$transaction([
      this.prisma.exchangeRateSnapshot.findMany({ where, orderBy: { rateDate: 'desc' }, skip, take }),
      this.prisma.exchangeRateSnapshot.count({ where }),
    ]);
    return paginated(redovi, total, page, limit);
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

  // §11 — dnevni automatski uvoz sa NBS stranice. Idempotentno (unique currency+rateDate) —
  // poziv istog dana više puta ne pravi duplikate, samo tiho preskoči već postojeći zapis.
  // Poziva ga NbsRateImportCron (@Cron); izdvojeno ovde da bude testabilno i pozivo iz oba.
  async importFromNbs(): Promise<{ imported: string[]; skipped: string[] }> {
    const page = await this.nbsFetcher.fetchTodaysRates();
    const imported: string[] = [];
    const skipped: string[] = [];

    for (const row of page.rows) {
      try {
        await this.prisma.exchangeRateSnapshot.create({
          data: {
            currency: row.currency,
            rateDate: page.rateDate,
            nbsMiddleRate: row.rate,
            source: 'NBS_API',
          },
        });
        imported.push(row.currency);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          skipped.push(row.currency); // već uvezeno za taj dan (npr. cron pokrenut ručno dva puta)
          continue;
        }
        throw err;
      }
    }

    this.logger.log(
      `NBS uvoz kursa za ${page.rateDate.toISOString().slice(0, 10)}: uvezeno [${imported.join(', ')}], preskočeno [${skipped.join(', ')}].`,
    );
    return { imported, skipped };
  }
}
