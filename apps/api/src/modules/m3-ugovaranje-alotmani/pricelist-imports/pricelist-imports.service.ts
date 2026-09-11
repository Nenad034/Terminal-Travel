import { BadRequestException, Injectable } from '@nestjs/common';
import { AgeCategory, AgePricingMode, PricelistImportRow } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreatePricelistImportDto } from './dto/create-pricelist-import.dto';
import { PricelistService } from '../pricelist/pricelist.service';
import { PricelistVersionsService } from '../pricelist/pricelist-versions.service';
import { kljucRedaPredloga } from '../pricelist/pricelist-versions.service';
import {
  PredlogCenovnikaDto,
  PredlozenRedDto,
  PredlozenaUzrasnaCenaDto,
} from '../pricelist/dto/predlog-cenovnika.dto';
import { PrimeniUvozDto } from './dto/primeni-uvoz.dto';
import { normalizujPopunjenost } from './pricelist-storage';
import { KatalogSoba, poklopiTipSobe } from './room-type-match';

/** §4.2.10 — uzrasna cena iz uvoza u oblik koji predlog razume (snake_case → camelCase). */
function uzrastIzUvoza(raw: unknown): PredlozenaUzrasnaCenaDto[] | undefined {
  const lista = (raw ?? []) as {
    age_category?: string;
    occupant_index?: number | null;
    min_adults_present?: number | null;
    pricing_mode?: string;
    percentage?: number | null;
    flat_price?: number | null;
  }[];
  if (!Array.isArray(lista) || lista.length === 0) return undefined;
  return lista.map((a) => ({
    ageCategory: a.age_category as AgeCategory,
    occupantIndex: a.occupant_index ?? undefined,
    minAdultsPresent: a.min_adults_present ?? undefined,
    pricingMode: a.pricing_mode as AgePricingMode,
    percentage: a.percentage ?? undefined,
    flatPrice: a.flat_price ?? undefined,
  }));
}

/** „2027-06-01" → „01.06.2027." — oznaka sezone se čita, ne dešifruje. */
function srpskiDatum(iso: string): string {
  const [g, m, d] = iso.split('-');
  return `${d}.${m}.${g}.`;
}

/**
 * §2.11m — tipovi soba iz `M2 Product.attributes` (M2 §2.3a).
 *
 * `attributes` je JSONB bez šeme (M2 §2, namerno) — zato se čita odbrambeno: podržana su oba
 * zapisa imena (`room_types` iz spec-a i `roomTypes` iz ranijih upisa, isti par već postoji u
 * M5 `quote-item-builder`), a stavka bez `code` se preskače umesto da obori uvoz.
 */
function sobeIzProizvoda(attributes: unknown): KatalogSoba[] {
  const a = (attributes ?? {}) as Record<string, unknown>;
  const sirovo = a.room_types ?? a.roomTypes;
  if (!Array.isArray(sirovo)) return [];
  return sirovo
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .filter((x) => typeof x.code === 'string' && (x.code as string).trim().length > 0)
    .map((x) => ({ code: x.code as string, name: typeof x.name === 'string' ? x.name : null }));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface NovaSezona {
  code: string;
  label: string;
  od: string;
  do: string;
  ranges: { dateFrom: string; dateTo: string }[];
}

interface RedGrupe {
  rowId: string;
  predlog: PredlozenRedDto;
}

/**
 * §2.11m — jedan tekst tipa sobe iz dokumenta i šta je od njega postalo. Prijavljuje se PO
 * TEKSTU, ne po redu: čovek na ekranu odlučuje o tipu sobe jednom, a ne o svakom redu cenovnika
 * koji taj tip nosi.
 */
export interface TipSobeUvoza {
  tekst: string;
  /** Šifra iz kataloga; `null` = katalog ovaj tip ne prepoznaje i niko ga još nije poklopio. */
  code: string | null;
  /** Kako je poklopljeno — `RUCNO` kad je čovek izabrao, inače stepen automatskog poklapanja. */
  nacin: 'SIFRA' | 'NAZIV' | 'DEO_NAZIVA' | 'RUCNO' | null;
  brojRedova: number;
}

interface GrupaUgovora {
  contractId: string;
  contractNumber: string;
  supplierName: string;
  noveSezone: NovaSezona[];
  redovi: RedGrupe[];
  /** §2.11m — šta ekran nudi u biraču tipa sobe za ovaj ugovor. */
  katalogSobe: KatalogSoba[];
  tipoviSoba: TipSobeUvoza[];
}

@Injectable()
export class PricelistImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly versions: PricelistVersionsService,
    private readonly pricelist: PricelistService,
  ) {}

  findAll() {
    return this.prisma.pricelistImport.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.pricelistImport.findUniqueOrThrow({
      where: { id },
      include: { rows: true },
    });
  }

  listRows(importId: string) {
    return this.prisma.pricelistImportRow.findMany({ where: { pricelistImportId: importId } });
  }

  // M3 spec §4.2.1 — status ostaje PROCESSING: stvarna AI ekstrakcija (§4.2, korak
  // "AI agent učitava dokument") zahteva odluku o AI provajderu koja još nije doneta
  // (isti obrazac kao M1 email TODO, M2 §3.3 uvoz sadržaja hotela). Kad se poveže,
  // ekstrakcija menja status u READY_FOR_REVIEW i kreira PricelistImportRow zapise.
  async create(dto: CreatePricelistImportDto, actorId: string) {
    const importRecord = await this.prisma.pricelistImport.create({
      data: { ...dto, status: 'PROCESSING', createdBy: actorId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_import.created',
      resourceType: 'PricelistImport',
      resourceId: importRecord.id,
      afterState: importRecord,
      context: {},
    });
    return importRecord;
  }

  /**
   * §4.2.10 (v1.39) — ODBIJANJE reda uvoza. Potvrda reda po red je **uklonjena**, vlasnikova
   * odluka 10.9.2026: uvoz od sada ide kroz razlike i tok verzija (§2.11l), jedan put do
   * cenovnika.
   *
   * Odbijanje ostaje, i nije drugi put do cenovnika: to je način da se iz predloga izbaci red
   * koji je AI pogrešno pročitao, pre nego što se razlike uopšte pogledaju.
   */
  async odbijRed(importId: string, rowId: string, actorId: string) {
    const row = await this.prisma.pricelistImportRow.findUniqueOrThrow({
      where: { id: rowId },
      include: { import: true },
    });
    if (row.import.id !== importId) {
      throw new BadRequestException('Stavka ne pripada navedenom uvozu');
    }

    const odbijen = await this.prisma.pricelistImportRow.update({
      where: { id: rowId },
      data: { reviewStatus: 'REJECTED', reviewedBy: actorId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_import_row.rejected',
      resourceType: 'PricelistImportRow',
      resourceId: rowId,
      context: { importId },
    });
    await this.maybeComplete(importId);
    return odbijen;
  }

  /**
   * §4.2.10 (v1.39) — uvoz kao PREDLOG, ne kao upis red po red.
   *
   * Redovi se grupišu **po ugovoru**, jer jedan dokument ume da sadrži više hotela, a verzija
   * cenovnika je pojam jednog ugovora. Za svaki ugovor se gradi predlog i uporedi sa zatečenim
   * cenovnikom — ništa se ne upisuje (§2.11l, pravilo 2).
   */
  async razlike(importId: string) {
    const uvoz = await this.prisma.pricelistImport.findUniqueOrThrow({ where: { id: importId } });
    const redovi = await this.prisma.pricelistImportRow.findMany({
      where: { pricelistImportId: importId, reviewStatus: 'PENDING' },
    });

    const grupe = await this.grupisiPoUgovoru(redovi);
    const rezultat = [];
    for (const g of grupe.grupe) {
      const dto = this.predlogZaUgovor(g);
      const r = await this.versions.predlozi(g.contractId, dto);
      rezultat.push({
        ...r,
        contractId: g.contractId,
        contractNumber: g.contractNumber,
        supplierName: g.supplierName,
        // Sezone koje bi tek nastale ako se razlika potvrdi — čovek mora da vidi da uvoz ne
        // dodaje samo cene nego i novu kolonu u mreži.
        noveSezone: g.noveSezone.map((s) => ({ code: s.code, label: s.label })),
        // §2.11m — ekran mora da vidi ŠTA je postalo od svakog teksta tipa sobe, pre nego što
        // potvrdi razlike: nepoklopljen tip završi u cenovniku kao sirov tekst koji prodaja ne
        // prepoznaje, a razlika izgleda uredno kao i svaka druga.
        katalogSobe: g.katalogSobe,
        tipoviSoba: g.tipoviSoba,
      });
    }

    return {
      importId,
      status: uvoz.status,
      ugovori: rezultat,
      // Red koji nije poklopljen sa proizvodom ne može ući ni u jedan predlog — mora se
      // videti kao zaseban spisak, inače tiho nestane iz uvoza (§4.2.3).
      nepoklopljeni: grupe.nepoklopljeni,
    };
  }

  /**
   * §4.2.10 — primena potvrđenih razlika ZA JEDAN UGOVOR, kroz isti `primeni` put koji koristi i
   * izmena rečima. `source_import_id` se ovde konačno popunjava.
   *
   * Nove sezone se prave **tek ovde**, i samo one iz kojih je bar jedna razlika potvrđena —
   * predlog i dalje ne upisuje ništa.
   */
  /**
   * §2.11m — čovek bira tip sobe iz kataloga za tekst koji automatsko poklapanje nije razrešilo.
   *
   * Odluka se upisuje na RED UVOZA, ne šalje se uz `primeni`. Razlog je merljiv: ključ razlike
   * (§2.11l) sadrži tip sobe, pa bi mapiranje poslato samo pri primeni promenilo ključeve u
   * odnosu na one koje je čovek video u spisku razlika — potvrdio bi jedno, primenilo bi se
   * drugo. Ovako `razlike` i `primeni` čitaju istu, sačuvanu odluku.
   *
   * Važi za sve PENDING redove tog uvoza sa istim tekstom — tip sobe je svojstvo sobe, ne reda.
   */
  async poklopiTipoveSobaUvoza(
    importId: string,
    mapiranja: { tekst: string; code: string }[],
    actorId: string,
  ) {
    if (mapiranja.length === 0) {
      throw new BadRequestException('Nije poslato nijedno poklapanje tipa sobe.');
    }

    let ukupno = 0;
    for (const m of mapiranja) {
      const tekst = m.tekst.trim();
      const code = m.code.trim();
      if (tekst.length === 0 || code.length === 0) {
        throw new BadRequestException(
          'Poklapanje tipa sobe traži i tekst iz dokumenta i šifru iz kataloga.',
        );
      }
      const r = await this.prisma.pricelistImportRow.updateMany({
        where: { pricelistImportId: importId, reviewStatus: 'PENDING', extractedRoomType: tekst },
        data: { matchedRoomTypeCode: code },
      });
      ukupno += r.count;
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_import.room_type_matched',
      resourceType: 'PricelistImport',
      resourceId: importId,
      afterState: { mapiranja, redova: ukupno },
      context: { importId },
    });

    return { redova: ukupno };
  }

  async primeniZaUgovor(
    importId: string,
    contractId: string,
    dto: PrimeniUvozDto,
    actorId: string,
  ) {
    const redovi = await this.prisma.pricelistImportRow.findMany({
      where: { pricelistImportId: importId, reviewStatus: 'PENDING' },
    });
    const grupe = await this.grupisiPoUgovoru(redovi);
    const g = grupe.grupe.find((x) => x.contractId === contractId);
    if (!g) {
      throw new BadRequestException(
        'Ovaj uvoz nema nijedan red poklopljen sa proizvodom iz navedenog ugovora.',
      );
    }

    const predlog = this.predlogZaUgovor(g);
    const prihvaceni = dto.prihvaceniKljucevi ?? [];
    if (prihvaceni.length === 0) {
      throw new BadRequestException('Nijedna razlika nije potvrđena — nema šta da se primeni.');
    }

    // §2.11m — ograda pre bilo kakvog upisa: tip sobe koji katalog ne poznaje ide u cenovnik kao
    // sirov tekst, i takav red u prodaji ne može da prođe proveru kapaciteta (zamka 7.14). To sme
    // da se desi — dobavljač ima pravo na tip koji katalog još nema — ali kao IZBOR, ne ćutke.
    const nepoklopljeniTipovi = g.tipoviSoba
      .filter((t) => t.code === null)
      .filter((t) =>
        g.redovi.some(
          (x) =>
            x.predlog.roomType === t.tekst && prihvaceni.includes(kljucRedaPredloga(x.predlog)),
        ),
      )
      .map((t) => t.tekst);
    if (nepoklopljeniTipovi.length > 0 && !dto.dozvoliNepoklopljeneTipoveSoba) {
      throw new BadRequestException(
        `Ovi tipovi soba nisu poklopljeni sa katalogom: ${nepoklopljeniTipovi.join(', ')}. ` +
          'Izaberite sobu iz kataloga, ili izričito potvrdite upis bez poklapanja — tada provera ' +
          'kapaciteta nad tim redovima neće raditi (M3 §2.11m).',
      );
    }

    // Sezona koja ne postoji mora nastati PRE primene, jer `primeni` traži postojeću oznaku.
    // Prave se samo one koje nosi bar jedna potvrđena razlika — sezona bez ijedne potvrđene
    // cene bila bi prazna kolona u mreži.
    const potrebne = new Set(
      predlog.redovi
        .filter((r) => prihvaceni.includes(kljucRedaPredloga(r)))
        .map((r) => r.seasonCode),
    );
    for (const s of g.noveSezone) {
      if (!potrebne.has(s.code)) continue;
      await this.pricelist.createSeason(
        contractId,
        { code: s.code, label: s.label, ranges: s.ranges },
        actorId,
      );
    }

    const rezultat = await this.versions.primeni(
      contractId,
      {
        ...predlog,
        prihvaceniKljucevi: prihvaceni,
        effectiveFrom: dto.effectiveFrom,
        sourceImportId: importId,
      },
      actorId,
    );

    // Red uvoza koji je učestvovao u primenjenoj razlici je time obrađen. Ostali ostaju
    // PENDING — čovek ih još nije ni potvrdio ni odbio, i to stanje mora ostati vidljivo.
    const obradjeni = g.redovi
      .filter((x) => prihvaceni.includes(kljucRedaPredloga(x.predlog)))
      .map((x) => x.rowId);
    if (obradjeni.length > 0) {
      await this.prisma.pricelistImportRow.updateMany({
        where: { id: { in: obradjeni } },
        data: { reviewStatus: 'CONFIRMED', reviewedBy: actorId },
      });
      await this.osveziProfil(importId, obradjeni[0], actorId);
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_import.applied',
      resourceType: 'PricelistImport',
      resourceId: importId,
      afterState: { contractId, primenjeno: prihvaceni.length, redova: obradjeni.length },
      context: { importId },
    });

    await this.maybeComplete(importId);
    return rezultat;
  }

  /**
   * §4.2.10 — grupisanje redova uvoza po ugovoru, i izvođenje sezone iz datuma.
   *
   * Zašto po ugovoru: verzija cenovnika je pojam JEDNOG ugovora (§2.11l), a jedan dokument ume
   * da nosi više hotela. Ranije se to nije videlo, jer se upisivalo red po red.
   *
   * Zašto se sezona izvodi: dokument daje opseg boravka, a predlog traži oznaku sezone.
   * Poklapanje je namerno **tačno**, ne „preklapa se": 01.06–15.06 nije ista sezona kao
   * 01.06–30.06, i tiho svrstavanje u postojeću kolonu bi promenilo cenu za petnaest dana koje
   * niko nije potvrdio.
   */
  private async grupisiPoUgovoru(redovi: PricelistImportRow[]) {
    const poklopljeni = redovi.filter((r) => r.matchedProductId);
    const nepoklopljeni = redovi
      .filter((r) => !r.matchedProductId)
      .map((r) => ({
        rowId: r.id,
        hotel: r.extractedHotelName,
        matchConfidence: r.matchConfidence === null ? null : Number(r.matchConfidence),
      }));

    const proizvodi = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(poklopljeni.map((r) => r.matchedProductId!))] } },
      select: { id: true, sourceContractId: true, attributes: true },
    });
    const ugovorPoProizvodu = new Map(proizvodi.map((p) => [p.id, p.sourceContractId]));
    // §2.11m — šifarnik tipova soba tog objekta; bez njega bi u `ContractPeriod.room_type`
    // otišao sirov tekst iz dokumenta, koji M5 pri prodaji ne prepoznaje (zamka 7.14).
    const sobePoProizvodu = new Map(proizvodi.map((p) => [p.id, sobeIzProizvoda(p.attributes)]));

    const poUgovoru = new Map<string, PricelistImportRow[]>();
    for (const r of poklopljeni) {
      const contractId = ugovorPoProizvodu.get(r.matchedProductId!);
      if (!contractId) {
        nepoklopljeni.push({
          rowId: r.id,
          hotel: r.extractedHotelName,
          matchConfidence: r.matchConfidence === null ? null : Number(r.matchConfidence),
        });
        continue;
      }
      const lista = poUgovoru.get(contractId) ?? [];
      lista.push(r);
      poUgovoru.set(contractId, lista);
    }

    const grupe: GrupaUgovora[] = [];
    for (const [contractId, lista] of poUgovoru) {
      const ugovor = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: { contractNumber: true, supplier: { select: { name: true } } },
      });
      const sezone = await this.prisma.season.findMany({
        where: { contractId },
        include: { ranges: true },
      });

      const noveSezone: NovaSezona[] = [];
      const redoviGrupe: RedGrupe[] = [];
      const tipoviSoba = new Map<string, TipSobeUvoza>();
      // Katalog je isti za sve redove jednog ugovora — uzima se iz proizvoda koje ti redovi
      // pogađaju, bez ponovnog upita.
      const katalogSobe = [
        ...new Map(
          lista
            .flatMap((r) => sobePoProizvodu.get(r.matchedProductId!) ?? [])
            .map((soba) => [soba.code, soba] as const),
        ).values(),
      ];

      for (const r of lista) {
        const od = iso(r.extractedStayFrom);
        const doo = iso(r.extractedStayTo);
        const postojeca = sezone.find((s) =>
          s.ranges.some((x) => iso(x.dateFrom) === od && iso(x.dateTo) === doo),
        );
        let code = postojeca?.code;
        if (!code) {
          const vecPredlozena = noveSezone.find((s) => s.od === od && s.do === doo);
          if (vecPredlozena) {
            code = vecPredlozena.code;
          } else {
            code = this.sledecaOznakaSezone(sezone, noveSezone);
            noveSezone.push({
              code,
              label: `${srpskiDatum(od)}–${srpskiDatum(doo)}`,
              od,
              do: doo,
              ranges: [{ dateFrom: od, dateTo: doo }],
            });
          }
        }

        // §2.11m — tri izvora šifre, po opadajućoj pouzdanosti: ranija LJUDSKA odluka, automatsko
        // poklapanje sa katalogom, i — kad nijedno ne uspe — sirov tekst iz dokumenta. Treći
        // slučaj se PRIJAVLJUJE na ekranu (`tipoviSoba`), ne pušta se tiho: to je tačka na kojoj
        // se cenovnik razilazi sa katalogom.
        const sobe = sobePoProizvodu.get(r.matchedProductId!) ?? [];
        const rucno = r.matchedRoomTypeCode;
        const auto = rucno ? null : poklopiTipSobe(r.extractedRoomType, sobe);
        const sifraSobe = rucno ?? auto?.code ?? r.extractedRoomType;
        const zapis = tipoviSoba.get(r.extractedRoomType) ?? {
          tekst: r.extractedRoomType,
          code: rucno ?? auto?.code ?? null,
          nacin: rucno ? ('RUCNO' as const) : (auto?.nacin ?? null),
          brojRedova: 0,
        };
        zapis.brojRedova++;
        tipoviSoba.set(r.extractedRoomType, zapis);

        redoviGrupe.push({
          rowId: r.id,
          predlog: {
            roomType: sifraSobe,
            seasonCode: code,
            boardType: r.extractedBoardType,
            occupancy: normalizujPopunjenost(r.extractedOccupancy, r.extractedPriceBasis),
            priceBasis: r.extractedPriceBasis ?? 'PER_ROOM_PER_NIGHT',
            price: r.extractedPrice,
            cribFeePerNight: r.extractedCribFeePerNight ?? undefined,
            agePricing: uzrastIzUvoza(r.extractedAgePricing),
          },
        });
      }

      grupe.push({
        contractId,
        contractNumber: ugovor?.contractNumber ?? contractId,
        supplierName: ugovor?.supplier?.name ?? '',
        noveSezone,
        redovi: redoviGrupe,
        katalogSobe,
        tipoviSoba: [...tipoviSoba.values()],
      });
    }

    return { grupe, nepoklopljeni };
  }

  /** Oznaka nove sezone: sledeći slobodan broj u tom ugovoru (§4.2.10, namerna granica). */
  private sledecaOznakaSezone(postojece: { code: string }[], nove: { code: string }[]): string {
    const zauzete = new Set([...postojece, ...nove].map((s) => s.code));
    let n = 1;
    while (zauzete.has(String(n))) n++;
    return String(n);
  }

  private predlogZaUgovor(g: GrupaUgovora): PredlogCenovnikaDto {
    return {
      // `effectiveFrom` popunjava čovek pri primeni; za prikaz razlika je nebitan.
      effectiveFrom: new Date().toISOString().slice(0, 10),
      redovi: g.redovi.map((r) => r.predlog),
    };
  }

  /** §4.2.5 — profil dobavljača se tiho osvežava, ista akcija kao ranije pri potvrdi reda. */
  private async osveziProfil(importId: string, rowId: string, actorId: string) {
    void actorId;
    const red = await this.prisma.pricelistImportRow.findUnique({
      where: { id: rowId },
      include: { import: true },
    });
    if (!red) return;
    await this.prisma.supplierExtractionProfile.upsert({
      where: { supplierId: red.import.supplierId },
      create: {
        supplierId: red.import.supplierId,
        typicalPriceBasis: red.extractedPriceBasis,
        typicalAgeThresholds: red.extractedAgePricing ?? undefined,
        lastConfirmedImportId: importId,
      },
      update: {
        typicalPriceBasis: red.extractedPriceBasis,
        typicalAgeThresholds: red.extractedAgePricing ?? undefined,
        lastConfirmedImportId: importId,
      },
    });
  }

  private async maybeComplete(importId: string) {
    const pending = await this.prisma.pricelistImportRow.count({
      where: { pricelistImportId: importId, reviewStatus: 'PENDING' },
    });
    if (pending === 0) {
      await this.prisma.pricelistImport.update({
        where: { id: importId },
        data: { status: 'COMPLETED' },
      });
    }
  }
}
