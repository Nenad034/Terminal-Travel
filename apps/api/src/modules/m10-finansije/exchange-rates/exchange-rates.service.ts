import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type PaginationQueryDto, paginated, paginationArgs } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { type NbsRatePage, NbsRateFetcherService, TRACKED_CURRENCIES } from './nbs-rate-fetcher.service';

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
    try {
      return await this.prisma.exchangeRateSnapshot.create({
        data: {
          currency: dto.currency,
          rateDate: new Date(dto.rateDate),
          nbsMiddleRate: dto.nbsMiddleRate,
          source: 'MANUAL',
        },
      });
    } catch (err) {
      // Dan koji već ima kurs (jedinstveni indeks `@@unique([currency, rate_date])`) je
      // NAJVEROVATNIJA greška pri ručnom unosu — čovek unosi kurs baš zato što misli da
      // nedostaje. Bez ovoga bi dobio golo `500 Internal server error` i ne bi znao ni šta je
      // pošlo naopako ni šta da uradi (ista klasa kao zamka 13.1). Postojeći zapis se NE
      // prepisuje: kurs koji je već upotrebljen u obračunu ne sme se tiho promeniti pod nogama
      // dokumentima koji se na njega pozivaju.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `Kurs za ${dto.currency} na dan ${dto.rateDate} već postoji i ne prepisuje se.`,
        );
      }
      throw err;
    }
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
    return this.upisiStranicu(await this.nbsFetcher.fetchTodaysRates());
  }

  /**
   * Dovlači kurs za JEDAN raniji dan (M10 spec §3.1a). Vraća `null` kad NBS za taj dan vrati
   * listu nekog RANIJEG dana — to nije greška nego neradni dan (NBS vraća poslednju važeću
   * listu), i zapis za taj raniji dan ili već postoji ili će ga doneti njegov sopstveni poziv.
   */
  async importFromNbsForDate(date: Date): Promise<{ imported: string[]; skipped: string[] } | null> {
    const page = await this.nbsFetcher.fetchRatesForDate(date);
    if (page.rateDate.toISOString().slice(0, 10) !== date.toISOString().slice(0, 10)) {
      this.logger.log(
        `NBS za ${date.toISOString().slice(0, 10)} vraća listu od ${page.rateDate.toISOString().slice(0, 10)} — neradni dan, preskačem.`,
      );
      return null;
    }
    return this.upisiStranicu(page);
  }

  /**
   * Popunjava rupe u kursnoj listi za zadati raspon dana (M10 spec §3.1a).
   *
   * ZAŠTO POSTOJI: dnevni uvoz povlači isključivo današnji kurs, pa svaki dan kad ne prođe
   * (server ugašen, NBS nedostupan, sistem tek postavljen) ostaje TRAJNO bez kursa — ništa ga
   * nikad ne pokušava ponovo. Posledica nije greška nego tišina: M13 odloži sinhronizaciju
   * uplate i izveštaj o naplati ostane prazan, bez poruke korisniku.
   *
   * Traže se samo dani kojih NEMA u bazi — postojeći se ne diraju (ni oni uneti ručno).
   * Razmak između poziva postoji da se javni izvor ne opterećuje; ovo nije ugovoren API.
   */
  async backfillMissingRates(
    from: Date,
    to: Date,
    opcije?: { pauseMs?: number; onProgress?: (dan: string, ishod: string) => void },
  ): Promise<{ popunjeno: number; preskoceno: number; neuspelo: number }> {
    const pauseMs = opcije?.pauseMs ?? 400;
    const postojeci = await this.prisma.exchangeRateSnapshot.findMany({
      where: { rateDate: { gte: from, lte: to } },
      select: { rateDate: true, currency: true },
    });
    const imaSve = new Set<string>();
    for (const valuta of TRACKED_CURRENCIES) {
      for (const zapis of postojeci) {
        if (zapis.currency === valuta) imaSve.add(`${valuta}|${zapis.rateDate.toISOString().slice(0, 10)}`);
      }
    }

    let popunjeno = 0;
    let preskoceno = 0;
    let neuspelo = 0;
    for (let dan = new Date(from); dan <= to; dan = new Date(dan.getTime() + 24 * 60 * 60 * 1000)) {
      const kljuc = dan.toISOString().slice(0, 10);
      const nedostaje = TRACKED_CURRENCIES.some((v) => !imaSve.has(`${v}|${kljuc}`));
      if (!nedostaje) {
        preskoceno += 1;
        opcije?.onProgress?.(kljuc, 'već postoji');
        continue;
      }
      try {
        const rezultat = await this.importFromNbsForDate(dan);
        if (rezultat === null) {
          preskoceno += 1;
          opcije?.onProgress?.(kljuc, 'neradni dan');
        } else {
          popunjeno += 1;
          opcije?.onProgress?.(kljuc, `uvezeno ${rezultat.imported.join(', ') || '(ništa novo)'}`);
        }
      } catch (err) {
        // Jedan neuspeo dan ne sme prekinuti ceo raspon — sledeći prolaz ga pokušava ponovo.
        neuspelo += 1;
        opcije?.onProgress?.(kljuc, `NEUSPELO: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    }

    this.logger.log(`Popunjavanje kursne liste: ${popunjeno} dana uvezeno, ${preskoceno} preskočeno, ${neuspelo} neuspelo.`);
    return { popunjeno, preskoceno, neuspelo };
  }

  private async upisiStranicu(page: NbsRatePage): Promise<{ imported: string[]; skipped: string[] }> {
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
