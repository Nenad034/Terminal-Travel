import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PricelistService } from './pricelist.service';
import { danUtc } from './season-ranges';
import { kljucCene, kljucDoplate, Razlika, SnapshotRed, uporedi } from './pricelist-diff';
import { PredlogCenovnikaDto } from './dto/predlog-cenovnika.dto';
import { PotvrdiVerzijuDto } from './dto/potvrdi-verziju.dto';

/**
 * M3 spec §2.11l — verzije cenovnika.
 *
 * Postoje **dva ulaza u isti tok**, i razlika među njima je namerna:
 *
 *  1. **Ručna izmena u mreži.** Čovek menja ćelije, izmena se primenjuje odmah (§2.4c: gašenje
 *     stare stavke i upis nove). Verzija se snima posle, kao zapis: „ovo je cenovnik od 1. juna,
 *     a evo šta se promenilo u odnosu na prethodnu verziju". Ulaz: `razlikeUOdnosuNaPoslednju`
 *     pa `potvrdi`.
 *  2. **Predlog spolja** — uvoz dokumenta (§4.2) ili izmena rečima (§4.8). Tu izmena **ne sme**
 *     da se primeni pre potvrde, jer je predlagač mašina. Ulaz: `predlozi` (ništa ne upisuje,
 *     vraća samo razlike) pa `primeni` (upisuje **isključivo potvrđene** razlike).
 *
 * Zajedničko je da verzija nosi **snimak** celog cenovnika, ne samo razlike. Bez snimka se
 * razlika prema prošloj verziji ne može izračunati kasnije: žive tabele se u međuvremenu menjaju
 * (stavke se gase i zamenjuju), pa „kako je cenovnik izgledao tada" prestaje da bude upit.
 */
@Injectable()
export class PricelistVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pricelist: PricelistService,
  ) {}

  // ──────────────────────────────────────────────────────────── čitanje

  async listVersions(contractId: string) {
    await this.assertContract(contractId);
    const verzije = await this.prisma.pricelistVersion.findMany({
      where: { contractId },
      orderBy: { versionNo: 'desc' },
    });
    return {
      contractId,
      versions: verzije.map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        effectiveFrom: iso(v.effectiveFrom),
        changeCount: v.changeCount,
        stavki: Array.isArray(v.snapshot) ? (v.snapshot as unknown[]).length : 0,
        note: v.note,
        instructionText: v.instructionText,
        sourceImportId: v.sourceImportId,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  /** Jedna verzija sa celim snimkom — ovo je ono što ostaje čitljivo i posle novih verzija. */
  async getVersion(contractId: string, versionNo: number) {
    const v = await this.nadjiVerziju(contractId, versionNo);
    return {
      contractId,
      versionNo: v.versionNo,
      effectiveFrom: iso(v.effectiveFrom),
      note: v.note,
      instructionText: v.instructionText,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
      snapshot: v.snapshot as unknown as SnapshotRed[],
    };
  }

  /** Razlike jedne verzije prema onoj pre nje. Prva verzija se poredi sa praznim cenovnikom. */
  async diffVerzije(contractId: string, versionNo: number) {
    const v = await this.nadjiVerziju(contractId, versionNo);
    const prethodna = await this.prisma.pricelistVersion.findFirst({
      where: { contractId, versionNo: { lt: versionNo } },
      orderBy: { versionNo: 'desc' },
    });
    const stara = (prethodna?.snapshot as unknown as SnapshotRed[]) ?? [];
    const razlike = uporedi(stara, v.snapshot as unknown as SnapshotRed[]);
    return {
      contractId,
      versionNo,
      uporedjenoSa: prethodna?.versionNo ?? null,
      razlike,
      ukupno: razlike.length,
    };
  }

  /**
   * Razlike **živog cenovnika** prema poslednjoj potvrđenoj verziji.
   *
   * Ovo je ekran koji čovek gleda posle ručne izmene: ne ceo cenovnik od dvesta redova, nego
   * deset redova koji su se promenili.
   */
  async razlikeUOdnosuNaPoslednju(contractId: string) {
    await this.assertContract(contractId);
    const poslednja = await this.poslednjaVerzija(contractId);
    const sada = await this.snimiStanje(contractId);
    const razlike = uporedi((poslednja?.snapshot as unknown as SnapshotRed[]) ?? [], sada);
    return {
      contractId,
      poslednjaVerzija: poslednja?.versionNo ?? null,
      sledecaVerzija: (poslednja?.versionNo ?? 0) + 1,
      razlike,
      ukupno: razlike.length,
      stavkiUCenovniku: sada.length,
    };
  }

  // ──────────────────────────────────────────────────────────── ručni tok

  /**
   * Snima trenutno stanje cenovnika kao novu verziju.
   *
   * Ne menja nijednu cenu — izmene su već primenjene kroz mrežu. Ovo je zapis, i zato nosi
   * `changeCount`: koliko je razlika ta verzija donela u odnosu na prethodnu.
   */
  async potvrdi(contractId: string, dto: PotvrdiVerzijuDto, actorId: string) {
    await this.assertContract(contractId);
    const poslednja = await this.poslednjaVerzija(contractId);
    const sada = await this.snimiStanje(contractId);
    const razlike = uporedi((poslednja?.snapshot as unknown as SnapshotRed[]) ?? [], sada);

    if (razlike.length === 0 && poslednja) {
      throw new BadRequestException(
        `Cenovnik je istovetan verziji ${poslednja.versionNo} — nova verzija bez ijedne razlike ` +
          `samo pravi šum u istoriji (M3 spec §2.11l).`,
      );
    }

    const verzija = await this.upisiVerziju(contractId, {
      snapshot: sada,
      changeCount: razlike.length,
      effectiveFrom: dto.effectiveFrom,
      note: dto.note ?? null,
      instructionText: dto.instructionText ?? null,
      sourceImportId: dto.sourceImportId ?? null,
      actorId,
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_version.created',
      resourceType: 'PricelistVersion',
      resourceId: verzija.id,
      context: { contractId, versionNo: verzija.versionNo, razlika: razlike.length },
    });

    return {
      id: verzija.id,
      versionNo: verzija.versionNo,
      effectiveFrom: iso(verzija.effectiveFrom),
      changeCount: verzija.changeCount,
      razlike,
    };
  }

  // ──────────────────────────────────────────────────────────── predlog spolja (§4.2 / §4.8)

  /**
   * Predlog novog cenovnika — **ništa se ne upisuje**. Vraća samo razlike prema živom stanju.
   *
   * Ulaz je spisak cenovnih redova onako kako ih je AI pročitao iz dokumenta. Sve što u predlogu
   * nije navedeno smatra se ugašenim, jer nov cenovnik dobavljača zamenjuje stari — ali gašenje
   * je i dalje **razlika koju čovek potvrđuje**, ne posledica koja se desi sama.
   */
  async predlozi(contractId: string, dto: PredlogCenovnikaDto) {
    await this.assertContract(contractId);
    const sada = await this.snimiStanje(contractId);
    const predlozeno = await this.snapshotIzPredloga(contractId, dto);

    // Doplate se ovim putem ne menjaju (vidi `primeni`), pa se prenose netaknute — inače bi
    // svaki predlog cena prikazao svaku doplatu kao „ugašena", što nije istina.
    const doplate = sada.filter((r) => r.vrsta === 'DOPLATA');
    const razlike = uporedi(sada, [...predlozeno, ...doplate]);

    return {
      contractId,
      razlike,
      ukupno: razlike.length,
      /** Ključevi svih razlika — panel ih šalje nazad, umanjene za one koje je čovek odbio. */
      sviKljucevi: razlike.map((r) => r.kljuc),
    };
  }

  /**
   * Primena predloga — **isključivo potvrđene razlike**.
   *
   * Tu „čovek potvrđuje razlike, ne ceo cenovnik" prestaje da bude rečenica u specifikaciji:
   * deset potvrđenih izmena u cenovniku od dvesta redova menja deset redova. Sve ostalo ostaje
   * na staroj vrednosti, uključujući i stavke koje predlog izostavlja.
   */
  async primeni(contractId: string, dto: PredlogCenovnikaDto, actorId: string) {
    await this.assertContract(contractId);
    const prihvaceni = dto.prihvaceniKljucevi ?? [];
    if (prihvaceni.length === 0) {
      throw new BadRequestException(
        'Nijedna razlika nije potvrđena — nema šta da se primeni (M3 spec §2.11l).',
      );
    }

    const sada = await this.snimiStanje(contractId);
    const predlozeno = await this.snapshotIzPredloga(contractId, dto);
    const doplate = sada.filter((r) => r.vrsta === 'DOPLATA');
    const razlike = uporedi(sada, [...predlozeno, ...doplate]);

    const poKljucu = new Map(razlike.map((r) => [r.kljuc, r]));
    const nepoznati = prihvaceni.filter((k) => !poKljucu.has(k));
    if (nepoznati.length > 0) {
      throw new BadRequestException(
        `Potvrđene su razlike kojih više nema u cenovniku (${nepoznati.length}) — cenovnik se ` +
          `u međuvremenu promenio. Otvorite razlike ponovo pre potvrde (M3 spec §2.11l).`,
      );
    }

    // Namerna granica ovog prolaza: doplate i popusti se menjaju kroz svoj ekran (§2.11k), ne
    // kroz predlog cena. Prikazuju se u razlikama i ulaze u snimak, ali se ovim putem ne pišu —
    // predlog nema polja kojima bi se doplata opisala (osnova, uzrast, obaveznost, način plaćanja).
    const doplataPotvrdjena = prihvaceni.filter((k) => poKljucu.get(k)!.stavka === 'DOPLATA');
    if (doplataPotvrdjena.length > 0) {
      throw new BadRequestException(
        'Doplate i popusti se menjaju na ekranu doplata, ne kroz predlog cena (M3 spec §2.11k). ' +
          'Izmenite ih tamo, pa potvrdite verziju.',
      );
    }

    const predlogPoKljucu = new Map(dto.redovi.map((r) => [kljucRedaPredloga(r), r]));
    const primenjeno: string[] = [];

    for (const kljuc of prihvaceni) {
      const razlika = poKljucu.get(kljuc)!;

      if (razlika.vrsta === 'UGASENA') {
        await this.ugasiPoKljucu(contractId, kljuc, actorId);
        primenjeno.push(kljuc);
        continue;
      }

      const red = predlogPoKljucu.get(kljuc);
      if (!red) {
        // Ne sme se desiti — ključ razlike NOVA/IZMENJENA nastaje iz predloga. Ako se ipak desi,
        // bolje je stati nego tiho preskočiti izmenu cene koju je čovek potvrdio.
        throw new BadRequestException(`Razlika ${kljuc} nema odgovarajući red u predlogu.`);
      }

      const season = await this.prisma.season.findFirst({
        where: { contractId, code: red.seasonCode },
      });
      if (!season) {
        throw new BadRequestException(
          `Sezona „${red.seasonCode}" ne postoji u ovom ugovoru — napravite je pre primene cena.`,
        );
      }

      await this.pricelist.writeCell(
        contractId,
        {
          seasonId: season.id,
          roomType: red.roomType,
          boardType: red.boardType,
          occupancy: red.occupancy,
          priceBasis: red.priceBasis,
          price: red.price,
          validWeekdays: red.validWeekdays ?? [],
          bookingFrom: red.bookingFrom,
          bookingTo: red.bookingTo,
        } as any,
        actorId,
      );
      primenjeno.push(kljuc);
    }

    const posle = await this.snimiStanje(contractId);
    const verzija = await this.upisiVerziju(contractId, {
      snapshot: posle,
      changeCount: primenjeno.length,
      effectiveFrom: dto.effectiveFrom,
      note: dto.note ?? null,
      instructionText: dto.instructionText ?? null,
      sourceImportId: dto.sourceImportId ?? null,
      actorId,
    });

    await this.auditLog.write({
      actorType: dto.instructionText ? 'AI_AGENT' : 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_version.applied',
      resourceType: 'PricelistVersion',
      resourceId: verzija.id,
      context: {
        contractId,
        versionNo: verzija.versionNo,
        primenjeno: primenjeno.length,
        ponudjeno: razlike.length,
        odbijeno: razlike.length - primenjeno.length,
        instructionText: dto.instructionText ?? null,
      },
    });

    return {
      id: verzija.id,
      versionNo: verzija.versionNo,
      effectiveFrom: iso(verzija.effectiveFrom),
      primenjeno: primenjeno.length,
      /** Razlike koje čovek NIJE potvrdio — ostale su na staroj vrednosti, nisu izgubljene. */
      odbijeno: razlike.filter((r) => !prihvaceni.includes(r.kljuc)).map((r) => r.poruka),
    };
  }

  // ──────────────────────────────────────────────────────────── snimak živog stanja

  /**
   * Ceo cenovnik jednog ugovora kao ravan spisak stavki.
   *
   * Čita se samo `ACTIVE` — ugašena stavka po §2.4c više nije cenovnik, nego istorija. Period bez
   * sezone se preskače: on nema kolonu u mreži, pa nema ni stabilan ključ između dve verzije.
   */
  private async snimiStanje(contractId: string): Promise<SnapshotRed[]> {
    const [periodi, doplate, sezone] = await Promise.all([
      this.prisma.contractPeriod.findMany({
        where: { contractId, status: 'ACTIVE', seasonId: { not: null } },
        include: {
          season: true,
          rateLines: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.ancillaryService.findMany({
        where: { contractId, status: 'ACTIVE' },
        include: { season: true },
      }),
      this.prisma.season.findMany({ where: { contractId } }),
    ]);
    void sezone;

    const redovi = new Map<string, SnapshotRed>();

    for (const p of periodi) {
      const seasonCode = p.season!.code;
      for (const r of p.rateLines) {
        const kljuc = kljucCene({
          roomType: p.roomType,
          seasonCode,
          boardType: r.boardType,
          occupancy: r.occupancy,
          priceBasis: r.priceBasis,
          validWeekdays: r.validWeekdays,
        });
        // Jedna sezona ima više datumskih opsega → više perioda sa istom cenom. U snimku je to
        // JEDNA stavka, isto kao jedna ćelija na ekranu (§2.11: koliko perioda stoji iza kolone
        // je unutrašnja stvar). Prvi period određuje vrednost; razilaženje cena unutar iste
        // sezone već prijavljuje mreža kao `neslozno`.
        if (redovi.has(kljuc)) continue;
        redovi.set(kljuc, {
          vrsta: 'CENA',
          kljuc,
          opis: opisCene(p.roomType, seasonCode, r.boardType, r.occupancy, r.validWeekdays),
          vrednost: r.price,
          detalji: {
            'prodaja od': r.bookingFrom ? iso(r.bookingFrom) : null,
            'prodaja do': r.bookingTo ? iso(r.bookingTo) : null,
            'doplata za krevetac': r.cribFeePerNight ?? null,
          },
        });
      }
    }

    for (const a of doplate) {
      const kljuc = kljucDoplate({
        name: a.name,
        kind: a.kind,
        seasonCode: a.season?.code ?? null,
        roomTypes: a.appliesToRoomTypes,
        ageFrom: a.ageFrom ? Number(a.ageFrom) : null,
        ageTo: a.ageTo ? Number(a.ageTo) : null,
      });
      if (redovi.has(kljuc)) continue;
      redovi.set(kljuc, {
        vrsta: 'DOPLATA',
        kljuc,
        opis: opisDoplate(a),
        vrednost: a.flatAmount ?? null,
        detalji: {
          osnova: a.priceBasis,
          obavezna: a.isMandatory,
          'plaća se': a.payable,
          procenat: a.percentageOfNightlyRate ? Number(a.percentageOfNightlyRate) : null,
          'važi od': a.appliesFrom ? iso(a.appliesFrom) : null,
          'važi do': a.appliesTo ? iso(a.appliesTo) : null,
        },
      });
    }

    return [...redovi.values()].sort((a, b) => a.kljuc.localeCompare(b.kljuc));
  }

  /** Predloženi cenovnik kao snimak — isti oblik, da poređenje bude jedan te isti proračun. */
  private async snapshotIzPredloga(
    contractId: string,
    dto: PredlogCenovnikaDto,
  ): Promise<SnapshotRed[]> {
    void contractId;
    return dto.redovi.map((r) => ({
      vrsta: 'CENA' as const,
      kljuc: kljucRedaPredloga(r),
      opis: opisCene(r.roomType, r.seasonCode, r.boardType, r.occupancy, r.validWeekdays ?? []),
      vrednost: r.price,
      detalji: {
        'prodaja od': r.bookingFrom ?? null,
        'prodaja do': r.bookingTo ?? null,
        'doplata za krevetac': null,
      },
    }));
  }

  /** Gašenje svih `ACTIVE` cenovnih redova koji odgovaraju ključu (§2.4c — gašenje, ne brisanje). */
  private async ugasiPoKljucu(contractId: string, kljuc: string, actorId: string) {
    const periodi = await this.prisma.contractPeriod.findMany({
      where: { contractId, status: 'ACTIVE', seasonId: { not: null } },
      include: { season: true, rateLines: { where: { status: 'ACTIVE' } } },
    });

    const zaGasenje: string[] = [];
    for (const p of periodi) {
      for (const r of p.rateLines) {
        const k = kljucCene({
          roomType: p.roomType,
          seasonCode: p.season!.code,
          boardType: r.boardType,
          occupancy: r.occupancy,
          priceBasis: r.priceBasis,
          validWeekdays: r.validWeekdays,
        });
        if (k === kljuc) zaGasenje.push(r.id);
      }
    }

    if (zaGasenje.length === 0) return;
    await this.prisma.rateLine.updateMany({
      where: { id: { in: zaGasenje } },
      data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
    });
  }

  // ──────────────────────────────────────────────────────────── pomoćno

  private async upisiVerziju(
    contractId: string,
    p: {
      snapshot: SnapshotRed[];
      changeCount: number;
      effectiveFrom: string;
      note: string | null;
      instructionText: string | null;
      sourceImportId: string | null;
      actorId: string;
    },
  ) {
    // Redni broj se čita i upisuje u istoj transakciji: dva istovremena potvrđivanja bi inače
    // dobila isti broj, a `@@unique([contractId, versionNo])` bi drugo oborilo bez objašnjenja.
    return this.prisma.$transaction(async (tx) => {
      const poslednja = await tx.pricelistVersion.findFirst({
        where: { contractId },
        orderBy: { versionNo: 'desc' },
      });
      return tx.pricelistVersion.create({
        data: {
          contractId,
          versionNo: (poslednja?.versionNo ?? 0) + 1,
          effectiveFrom: new Date(danUtc(p.effectiveFrom)),
          snapshot: p.snapshot as unknown as any,
          changeCount: p.changeCount,
          note: p.note,
          instructionText: p.instructionText,
          sourceImportId: p.sourceImportId,
          createdBy: p.actorId,
        },
      });
    });
  }

  private async poslednjaVerzija(contractId: string) {
    return this.prisma.pricelistVersion.findFirst({
      where: { contractId },
      orderBy: { versionNo: 'desc' },
    });
  }

  private async nadjiVerziju(contractId: string, versionNo: number) {
    const v = await this.prisma.pricelistVersion.findFirst({ where: { contractId, versionNo } });
    if (!v) throw new NotFoundException(`Verzija ${versionNo} ne postoji za ovaj ugovor.`);
    return v;
  }

  private async assertContract(contractId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!c) throw new NotFoundException('Ugovor nije pronađen.');
    return c;
  }
}

function kljucRedaPredloga(r: {
  roomType: string;
  seasonCode: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  validWeekdays?: number[] | null;
}): string {
  return kljucCene(r);
}

function opisCene(
  roomType: string,
  seasonCode: string,
  boardType: string,
  occupancy: string,
  dani: number[] | null | undefined,
): string {
  const d = dani && dani.length > 0 ? ` · dani ${[...dani].sort((a, b) => a - b).join(',')}` : '';
  return `${roomType} · sezona ${seasonCode} · ${boardType} · ${occupancy}${d}`;
}

function opisDoplate(a: {
  name: string;
  kind: string;
  season?: { code: string } | null;
  appliesToRoomTypes: string[];
  ageFrom: unknown;
  ageTo: unknown;
}): string {
  const domet = a.season ? `sezona ${a.season.code}` : 'ceo ugovor';
  const sobe = a.appliesToRoomTypes.length > 0 ? ` · ${a.appliesToRoomTypes.join(', ')}` : '';
  const uzrast =
    a.ageFrom != null || a.ageTo != null ? ` · uzrast ${a.ageFrom ?? 0}–${a.ageTo ?? '∞'}` : '';
  const vrsta = a.kind === 'DISCOUNT' ? 'popust' : 'doplata';
  return `${a.name} (${vrsta}) · ${domet}${sobe}${uzrast}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type { Razlika };
