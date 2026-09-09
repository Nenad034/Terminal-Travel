import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacityService } from '../capacity/capacity.service';
import { vaziZaDan, danUNedelji, imenaDana } from './weekday-coverage';
import { bookingWindowOpen } from '../contract-periods/day-capacity';
import { PricelistCalendarQueryDto } from './dto/pricelist-calendar-query.dto';
import {
  computeRoomBaseCost,
  jePoBoravku,
  RoomTypeDefinition,
} from '../../m5-rezervacije/common/occupancy';

/**
 * M3 spec §2.11o — kalendar cena i raspoloživosti. **Pregled, ne unos.**
 *
 * Vlasnikova ideja 9.9.2026: _„jedan kalendar sa mesecima za neki hotel za neki tip smeštaja za
 * neki period pa mi vidimo cenu u kalendaru"_. Vrednost nije u samom prikazu nego u tome što se
 * **greška vidi golim okom**: pogrešno unet datumski opseg pravi rupu ili skok u nizu, a to se u
 * mreži ne primeti. Ujedno je ovo jedino mesto gde se cena i kapacitet sreću — kapacitet se u sam
 * cenovnik namerno ne meša (§2.11n, vlasnikova odluka).
 *
 * **Nema novog zapisa u bazi** (spec to izričito traži): čita se cenovnik i postojeća mreža
 * kapaciteta (§2.8, `CapacityService.grid`).
 *
 * **Zašto se cena ne računa ovde nanovo.** Obračun cene za sastav gostiju (osnovna popunjenost,
 * doplata po uzrastu, krevetac) već postoji kao **čista funkcija** koju koristi prodaja
 * (`computeRoomBaseCost`). Druga formula za isti posao bi se pre ili kasnije razišla sa prvom, a
 * razlika bi se videla tek na računu. Zato se koristi ista.
 *
 * _Napomena o granicama modula:_ ta funkcija fizički stoji u `m5-rezervacije/common/occupancy.ts`,
 * iako opisuje M3 pravila (cenovni red, uzrasna politika). Ovde se uvozi kao **čista logika**, bez
 * ijednog upita nad tuđim podacima — isti obrazac koji već postoji u oba smera (`occupancy.ts`
 * uvozi M3 `weekday-coverage` i `age-pricing-resolution`, a M3 `create-contract-period.dto.ts`
 * uvozi `occupancy.ts`). Premeštanje tog fajla u zajednički folder je zavedeno u backlog.
 */
@Injectable()
export class PricelistCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: CapacityService,
  ) {}

  async kalendar(contractId: string, q: PricelistCalendarQueryDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { supplier: { select: { name: true } } },
    });
    if (!contract) throw new NotFoundException('Ugovor nije pronađen.');

    const od = dan(q.from);
    const doDatum = dan(q.to);
    if (doDatum < od) throw new BadRequestException('Datum „do" je pre datuma „od".');
    if ((doDatum.getTime() - od.getTime()) / MS_DAN > 92) {
      throw new BadRequestException('Raspon je ograničen na 92 dana (jedan kvartal).');
    }

    const roomType = q.roomType.trim();
    const sastav = {
      adults: q.adults,
      children: q.childrenAges?.length ?? 0,
      childrenAges: q.childrenAges ?? [],
    };

    // Periodi tog ugovora i tipa sobe koji dodiruju traženi raspon. Noć pripada danu prijave,
    // pa period pokriva noći [stayFrom, stayTo) — dan odjave nije noć.
    const periodi = await this.prisma.contractPeriod.findMany({
      where: {
        contractId,
        roomType,
        status: 'ACTIVE',
        stayFrom: { lte: doDatum },
        stayTo: { gte: od },
      },
      include: {
        season: true,
        rateLines: {
          where: { status: 'ACTIVE' },
          include: { agePricing: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const definicijaSobe = await this.definicijaSobe(contractId, roomType);

    // Raspoloživost iz postojeće mreže kapaciteta (§2.8) — ne računa se ovde ponovo.
    const mreza = await this.capacity.grid({
      from: iso(od),
      to: iso(doDatum),
      contractId,
      roomType,
      includeDraftContracts: true,
    } as any);
    const slobodnoPoDanu = new Map<
      string,
      { zaProdaju: number; saleStatus: string; stopReason: string | null }
    >();
    for (const red of mreza.rows) {
      for (const d of red.days as any[]) {
        if (d.capacity == null) continue;
        const prethodno = slobodnoPoDanu.get(d.date);
        // Više perioda istog tipa sobe na isti dan se sabira — ista logika kao na ekranu
        // kapaciteta: gost ne bira iz kog perioda mu soba dolazi.
        slobodnoPoDanu.set(d.date, {
          zaProdaju: (prethodno?.zaProdaju ?? 0) + d.zaProdaju,
          saleStatus: d.saleStatus === 'STOP' ? 'STOP' : (prethodno?.saleStatus ?? d.saleStatus),
          stopReason: d.stopReason ?? prethodno?.stopReason ?? null,
        });
      }
    }

    // Kombinacije su one koje u cenovniku stvarno postoje — ne unapred nabrojane (isti razlog
    // kao redovi mreže u §2.11).
    const kombinacije = new Map<string, Kombinacija>();
    for (const p of periodi) {
      for (const rl of p.rateLines) {
        const kljuc = `${rl.boardType}|${rl.occupancy}`;
        if (!kombinacije.has(kljuc)) {
          kombinacije.set(kljuc, {
            kljuc,
            boardType: rl.boardType,
            occupancy: rl.occupancy,
            priceBasis: rl.priceBasis,
            dani: [],
          });
        }
      }
    }

    const danas = new Date();
    const upozorenja: string[] = [];

    for (const komb of kombinacije.values()) {
      for (let d = new Date(od); d <= doDatum; d = new Date(d.getTime() + MS_DAN)) {
        komb.dani.push(
          this.jedanDan(d, komb, periodi, definicijaSobe, sastav, danas, slobodnoPoDanu),
        );
      }
      const bezCene = komb.dani.filter((x) => x.cena == null).length;
      if (bezCene > 0) {
        upozorenja.push(
          `${komb.boardType} · ${komb.occupancy}: ${bezCene} od ${komb.dani.length} dana nema cenu za ovaj sastav gostiju.`,
        );
      }
    }

    return {
      contractId,
      contractNumber: contract.contractNumber,
      supplierName: contract.supplier.name,
      currency: contract.currency,
      roomType,
      from: iso(od),
      to: iso(doDatum),
      sastav,
      kombinacije: [...kombinacije.values()],
      upozorenja,
    };
  }

  /**
   * Jedan dan jedne kombinacije.
   *
   * Cena je **za jednu noć koja počinje tog dana** — dan odjave nije noć, pa poslednji dan
   * raspona nosi cenu samo ako se te noći stvarno spava. Kad je osnova cene „za ceo boravak"
   * (`*_PER_STAY`), cena po noći ne postoji: prikazuje se iznos za boravak uz oznaku osnove, da
   * se ne bi čitao kao noćna cena.
   */
  private jedanDan(
    datum: Date,
    komb: Kombinacija,
    periodi: PeriodSaCenama[],
    definicijaSobe: RoomTypeDefinition,
    sastav: { adults: number; children: number; childrenAges: number[] },
    danas: Date,
    slobodno: Map<string, { zaProdaju: number; saleStatus: string; stopReason: string | null }>,
  ): DanKalendara {
    const kljucDana = iso(datum);
    const dostupnost = slobodno.get(kljucDana) ?? null;

    const period = periodi.find((p) => dan(p.stayFrom) <= datum && datum < dan(p.stayTo));
    const osnovno: DanKalendara = {
      date: kljucDana,
      cena: null,
      osnova: null,
      razlog: null,
      seasonCode: period?.season?.code ?? null,
      slobodno: dostupnost?.zaProdaju ?? null,
      saleStatus: dostupnost?.saleStatus ?? null,
      stopReason: dostupnost?.stopReason ?? null,
      dolazakMoguc: true,
    };

    if (!period) return { ...osnovno, razlog: 'VAN_PERIODA' };

    // §2.11d — turnusi. Dan koji nije dan prijave se prikazuje, ali se označava: cena postoji,
    // a boravak ne može tu da počne. Bez toga kalendar obećava nešto što prodaja odbija.
    const dolasci = period.arrivalWeekdays ?? [];
    const dolazakMoguc = dolasci.length === 0 || dolasci.includes(danUNedelji(datum));

    const redoviKombinacije = period.rateLines.filter(
      (rl) => `${rl.boardType}|${rl.occupancy}` === komb.kljuc,
    );
    const zaDan = redoviKombinacije.filter((rl) => vaziZaDan(rl, datum));
    if (zaDan.length === 0) {
      return {
        ...osnovno,
        dolazakMoguc,
        razlog: redoviKombinacije.length === 0 ? 'NEMA_CENE' : 'DAN_BEZ_CENE',
      };
    }

    // §2.11e — cena čiji je prozor prodaje prošao se ne prodaje, pa se ni u kalendaru ne
    // prikazuje kao da je na raspolaganju.
    const uPrimeni = zaDan.filter((rl) => bookingWindowOpen(rl, danas));
    if (uPrimeni.length === 0) {
      return { ...osnovno, dolazakMoguc, razlog: 'PROZOR_PRODAJE_ZATVOREN' };
    }

    const rateLine = uPrimeni[0];
    try {
      const cena = computeRoomBaseCost({
        room: {
          adults: sastav.adults,
          children: sastav.children,
          childrenAges: sastav.childrenAges,
        },
        roomType: definicijaSobe,
        rateLine: rateLine as any,
        agePricingCandidates: rateLine.agePricing as any,
        nights: 1,
        agePolicyOverride: (period.agePolicyOverride as any) ?? null,
      });
      return {
        ...osnovno,
        dolazakMoguc,
        cena,
        osnova: rateLine.priceBasis,
        razlog: jePoBoravku(rateLine.priceBasis) ? 'CENA_ZA_BORAVAK' : null,
      };
    } catch {
      // Najčešći uzrok: nema `age_pricing` reda za dete tog uzrasta (§2.4a). To je stvarna rupa
      // u cenovniku i tako se i prikazuje — cena se NE pretpostavlja, isto pravilo kao u prodaji.
      return { ...osnovno, dolazakMoguc, razlog: 'NEMA_CENE_ZA_UZRAST' };
    }
  }

  /**
   * Definicija tipa sobe iz M2 (kapacitet i uzrasna politika), preko `Product.sourceContractId`.
   *
   * Kad proizvod ne postoji ili nema taj tip sobe, koristi se široka zamena — isto što radi
   * pretraga (M5). Kalendar je pregled: bolje je prikazati cenu uz podrazumevanu uzrasnu politiku
   * nego prazan mesec, jer je prazan mesec nerazlučiv od greške u cenovniku.
   */
  private async definicijaSobe(contractId: string, roomType: string): Promise<RoomTypeDefinition> {
    const product = await this.prisma.product.findFirst({
      where: { sourceContractId: contractId },
      select: { attributes: true },
    });
    const sve = ((product?.attributes as any)?.roomTypes ??
      (product?.attributes as any)?.room_types ??
      []) as RoomTypeDefinition[];
    return (
      sve.find((r) => r.code === roomType) ?? {
        code: roomType,
        capacityAdults: 99,
        capacityChildren: 99,
      }
    );
  }
}

const MS_DAN = 86_400_000;

export interface DanKalendara {
  date: string;
  /** Cena za jednu noć koja počinje tog dana, u najmanjoj jedinici valute; `null` kad je nema. */
  cena: number | null;
  osnova: string | null;
  /** Zašto cene nema, ili šta o njoj treba znati. `null` = obična noćna cena. */
  razlog: string | null;
  seasonCode: string | null;
  slobodno: number | null;
  saleStatus: string | null;
  stopReason: string | null;
  /** §2.11d — sme li boravak tog dana da počne (dani prijave na periodu). */
  dolazakMoguc: boolean;
}

export interface Kombinacija {
  kljuc: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  dani: DanKalendara[];
}

type PeriodSaCenama = {
  stayFrom: Date;
  stayTo: Date;
  arrivalWeekdays: number[] | null;
  agePolicyOverride: unknown;
  season: { code: string } | null;
  rateLines: any[];
};

function dan(v: string | Date): Date {
  const d = v instanceof Date ? v : new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export { imenaDana };
