import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceBasis } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { assertNoContractPeriodOverlap } from '../contract-periods/overlap';
import { danUtc, proveriSezonu } from './season-ranges';
import { UpsertSeasonDto } from './dto/upsert-season.dto';
import { WriteCellDto } from './dto/write-cell.dto';
import { UpsertSurchargeDto } from './dto/upsert-surcharge.dto';
import { domet, ulaziUZbir } from './surcharge-scope';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';

/**
 * M3 spec §2.11 — cenovnik kao mreža.
 *
 * Ekran pokazuje jednu ćeliju po (sezona × tip sobe × cenovni red), ali baza ispod toga i
 * dalje ima `ContractPeriod` po datumskom opsegu. Ta razlika je namerna i ovde se prevodi:
 * sezona sa dva opsega (Aycon 2026: 01.04–31.05 I 01.10–31.10) proizvodi **dva** perioda za
 * isti tip sobe, a jedna potvrđena ćelija upisuje istu cenu u oba. Da se to radilo na ekranu,
 * korisnik bi morao da zna koliko perioda stoji iza jedne kolone — a to je unutrašnja stvar.
 */
@Injectable()
export class PricelistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ──────────────────────────────────────────────────────────── sezone

  async listSeasons(contractId: string) {
    await this.assertContract(contractId);
    return this.prisma.season.findMany({
      where: { contractId },
      orderBy: { rank: 'asc' },
      include: { ranges: { orderBy: { dateFrom: 'asc' } } },
    });
  }

  async createSeason(contractId: string, dto: UpsertSeasonDto, actorId: string) {
    await this.assertContract(contractId);
    await this.assertOpseziIspravni(contractId, dto, null);

    const postojeca = await this.prisma.season.findFirst({
      where: { contractId, code: dto.code },
    });
    if (postojeca) {
      throw new BadRequestException(`Sezona sa oznakom „${dto.code}" već postoji u ovom ugovoru.`);
    }

    const season = await this.prisma.season.create({
      data: {
        contractId,
        code: dto.code,
        label: dto.label ?? null,
        rank: dto.rank ?? (await this.sledeciRank(contractId)),
        ranges: {
          create: dto.ranges.map((r) => ({ dateFrom: dan(r.dateFrom), dateTo: dan(r.dateTo) })),
        },
      },
      include: { ranges: true },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'season.created',
      resourceType: 'Season',
      resourceId: season.id,
      context: { contractId, code: season.code, opsega: season.ranges.length },
    });
    return season;
  }

  async updateSeason(contractId: string, seasonId: string, dto: UpsertSeasonDto, actorId: string) {
    const stara = await this.assertSeason(contractId, seasonId);
    await this.assertOpseziIspravni(contractId, dto, seasonId);

    if (dto.code !== stara.code) {
      const zauzeta = await this.prisma.season.findFirst({
        where: { contractId, code: dto.code, NOT: { id: seasonId } },
      });
      if (zauzeta) {
        throw new BadRequestException(
          `Sezona sa oznakom „${dto.code}" već postoji u ovom ugovoru.`,
        );
      }
    }

    // Opsezi se zamenjuju u celini: delimično ažuriranje bi tražilo identitet reda koji korisnik
    // na ekranu nema (on vidi „01.04–31.05", ne uuid), a poređenje po datumima ne razlikuje
    // izmenu od brisanja + dodavanja.
    const season = await this.prisma.$transaction(async (tx) => {
      await tx.seasonRange.deleteMany({ where: { seasonId } });
      return tx.season.update({
        where: { id: seasonId },
        data: {
          code: dto.code,
          label: dto.label ?? null,
          rank: dto.rank ?? stara.rank,
          ranges: {
            create: dto.ranges.map((r) => ({ dateFrom: dan(r.dateFrom), dateTo: dan(r.dateTo) })),
          },
        },
        include: { ranges: true },
      });
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'season.updated',
      resourceType: 'Season',
      resourceId: seasonId,
      context: { contractId, code: season.code, opsega: season.ranges.length },
    });
    return season;
  }

  /**
   * Brisanje sezone NE briše periode — oni nose kapacitet i prodato (`onDelete: SetNull`).
   * Periodi ostaju, samo ispadaju iz kolone i prikazuju se kao izuzeci. Kad bi se brisali,
   * jedna pogrešno obrisana kolona odnela bi i cene i prodato.
   */
  async deleteSeason(contractId: string, seasonId: string, actorId: string) {
    const season = await this.assertSeason(contractId, seasonId);
    const perioda = await this.prisma.contractPeriod.count({ where: { seasonId } });

    await this.prisma.season.delete({ where: { id: seasonId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'season.deleted',
      resourceType: 'Season',
      resourceId: seasonId,
      context: { contractId, code: season.code, periodaOstalo: perioda },
    });
    return { deleted: true, periodaOstalo: perioda };
  }

  // ──────────────────────────────────────────────────────────── mreža

  async grid(contractId: string) {
    const contract = await this.assertContract(contractId);

    const [seasons, periods] = await Promise.all([
      this.prisma.season.findMany({
        where: { contractId },
        orderBy: { rank: 'asc' },
        include: { ranges: { orderBy: { dateFrom: 'asc' } } },
      }),
      this.prisma.contractPeriod.findMany({
        where: { contractId, status: 'ACTIVE' },
        orderBy: [{ roomType: 'asc' }, { stayFrom: 'asc' }],
        include: { rateLines: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    // Redovi mreže su kombinacije koje stvarno postoje u cenovniku — ne unapred nabrojane.
    // Isti razlog kao `AncillaryService` generički red (§2.6): koje kombinacije dobavljač
    // koristi ne može se unapred znati.
    const grupe = new Map<string, GridGrupa>();

    for (const p of periods) {
      let g = grupe.get(p.roomType);
      if (!g) {
        g = { roomType: p.roomType, rows: [], bezSezone: [] };
        grupe.set(p.roomType, g);
      }
      if (!p.seasonId) {
        g.bezSezone.push({
          periodId: p.id,
          stayFrom: iso(p.stayFrom),
          stayTo: iso(p.stayTo),
          cenovnihRedova: p.rateLines.length,
        });
      }

      for (const r of p.rateLines) {
        const key = redKljuc(r.boardType, r.occupancy, r.priceBasis);
        let row = g.rows.find((x) => x.key === key);
        if (!row) {
          row = {
            key,
            boardType: r.boardType,
            occupancy: r.occupancy,
            priceBasis: r.priceBasis,
            cells: {},
          };
          g.rows.push(row);
        }
        if (!p.seasonId) continue; // period bez sezone nema kolonu — prikazuje se kao izuzetak

        const c = row.cells[p.seasonId];
        if (!c) {
          row.cells[p.seasonId] = {
            price: r.price,
            rateLineIds: [r.id],
            periodIds: [p.id],
            bookingFrom: r.bookingFrom ? iso(r.bookingFrom) : null,
            bookingTo: r.bookingTo ? iso(r.bookingTo) : null,
            neslozno: false,
          };
        } else {
          c.rateLineIds.push(r.id);
          c.periodIds.push(p.id);
          // Jedna kolona = jedna cena. Ako se opsezi iste sezone razilaze, to se PRIKAZUJE
          // umesto da se tiho uzme prvi — razlika je verovatno greška u unosu.
          if (c.price !== r.price) c.neslozno = true;
        }
      }
    }

    return {
      contractId,
      contractNumber: contract.contractNumber,
      currency: contract.currency,
      commissionModel: contract.commissionModel,
      commissionPercentage: contract.commissionPercentage,
      seasons: seasons.map((s) => ({
        id: s.id,
        code: s.code,
        label: s.label,
        rank: s.rank,
        ranges: s.ranges.map((r) => ({ dateFrom: iso(r.dateFrom), dateTo: iso(r.dateTo) })),
      })),
      roomTypes: [...grupe.values()],
    };
  }

  /**
   * Upis jedne ćelije: ista cena u svaki period te sezone i tog tipa sobe.
   *
   * Ispravka postojeće cene ide po §2.4c — **gašenje stare i upis nove**, nikad prepisivanje.
   * Zato jedna ćelija koja se menja ostavlja trag, a ne samo novu vrednost.
   */
  async writeCell(contractId: string, dto: WriteCellDto, actorId: string) {
    await this.assertContract(contractId);
    const season = await this.assertSeason(contractId, dto.seasonId);
    if (season.ranges.length === 0) {
      throw new BadRequestException(
        'Sezona nema nijedan datumski opseg — dodajte ga pre unosa cene.',
      );
    }

    const roomType = dto.roomType.trim();
    if (!roomType) throw new BadRequestException('Tip sobe je obavezan.');

    // Periodi se prave PRE transakcije, jer provera preklapanja (§2.3b) mora da vrati 400 sa
    // svojom porukom — ista podela kao kod odobravanja reda uvoza (zamka 7.9).
    const periodIds: string[] = [];
    for (const r of season.ranges) {
      const stayFrom = dan(r.dateFrom);
      const stayTo = dan(r.dateTo);
      const postojeci = await this.prisma.contractPeriod.findFirst({
        where: { contractId, seasonId: season.id, roomType, stayFrom, stayTo, status: 'ACTIVE' },
      });
      if (postojeci) {
        periodIds.push(postojeci.id);
        continue;
      }
      await assertNoContractPeriodOverlap(this.prisma, contractId, roomType, stayFrom, stayTo);
      const nov = await this.prisma.contractPeriod.create({
        data: {
          contractId,
          seasonId: season.id,
          roomType,
          stayFrom,
          stayTo,
          // Kapacitet se NE unosi ovde (vlasnikova odluka §2.11n): ide po sopstvenim datumima,
          // nezavisno od sezona. Period nastao iz cenovnika je zato „na upit" dok mu se
          // kapacitet ne doda na ekranu kapaciteta.
          allotmentMode: 'ON_REQUEST',
        },
      });
      periodIds.push(nov.id);
    }

    const rezultat = await this.prisma.$transaction(async (tx) => {
      const upisane: string[] = [];
      let ugasenih = 0;

      for (const periodId of periodIds) {
        const stara = await tx.rateLine.findFirst({
          where: {
            contractPeriodId: periodId,
            boardType: dto.boardType,
            occupancy: dto.occupancy,
            status: 'ACTIVE',
          },
        });

        if (
          stara &&
          stara.price === dto.price &&
          stara.priceBasis === dto.priceBasis &&
          isteGranice(stara.bookingFrom, dto.bookingFrom) &&
          isteGranice(stara.bookingTo, dto.bookingTo)
        ) {
          upisane.push(stara.id);
          continue; // ništa se nije promenilo — bez lažnog traga u auditu
        }

        if (stara) {
          await tx.rateLine.update({
            where: { id: stara.id },
            data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
          });
          ugasenih++;
        }

        const nova = await tx.rateLine.create({
          data: {
            contractPeriodId: periodId,
            replacesId: stara?.id ?? null,
            boardType: dto.boardType,
            occupancy: dto.occupancy,
            priceBasis: dto.priceBasis,
            price: dto.price,
            bookingFrom: dto.bookingFrom ? dan(dto.bookingFrom) : null,
            bookingTo: dto.bookingTo ? dan(dto.bookingTo) : null,
          },
        });
        upisane.push(nova.id);
      }

      return { upisane, ugasenih };
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_cell.written',
      resourceType: 'Season',
      resourceId: season.id,
      context: {
        contractId,
        roomType,
        boardType: dto.boardType,
        occupancy: dto.occupancy,
        priceBasis: dto.priceBasis,
        price: dto.price,
        perioda: periodIds.length,
        ugasenih: rezultat.ugasenih,
      },
    });

    return {
      seasonId: season.id,
      roomType,
      periodIds,
      rateLineIds: rezultat.upisane,
      deactivated: rezultat.ugasenih,
    };
  }

  // ──────────────────────────────────────────────────────────── marža i provizija (§2.11i)

  /**
   * Sve stavke ugovora, sa naznakom koja od njih ima sopstveno pravilo marže/provizije.
   *
   * Vraćaju se **sve** stavke, ne samo izuzeci — čovek mora da vidi na šta uopšte može da
   * primeni izuzetak. Ali izuzeci idu prvi i nose oznaku, jer se ekran zbog njih i otvara.
   */
  async pricingRules(contractId: string) {
    await this.assertContract(contractId);

    const [periods, doplate] = await Promise.all([
      this.prisma.contractPeriod.findMany({
        where: { contractId, status: 'ACTIVE' },
        select: {
          id: true,
          roomType: true,
          rateLines: {
            where: { status: 'ACTIVE' },
            select: { id: true, boardType: true, occupancy: true, price: true },
          },
        },
      }),
      this.prisma.ancillaryService.findMany({
        where: { contractId, status: 'ACTIVE' },
        select: { id: true, name: true, kind: true, flatAmount: true },
      }),
    ]);

    const rateLineIds = periods.flatMap((p) => p.rateLines.map((r) => r.id));
    const ancillaryIds = doplate.map((d) => d.id);
    const gde = [
      { scopeType: 'M3_RATE_LINE' as const, scopeId: { in: rateLineIds } },
      { scopeType: 'M3_ANCILLARY_SERVICE' as const, scopeId: { in: ancillaryIds } },
    ];

    const [marze, provizije] = await Promise.all([
      this.prisma.markupRule.findMany({ where: { OR: gde } }),
      this.prisma.subagentCommissionOverride.findMany({ where: { OR: gde } }),
    ]);
    const marzaZa = new Map(marze.map((m) => [m.scopeId, m]));
    const provizijaZa = new Map(provizije.map((p) => [p.scopeId, p]));

    const stavke = [
      ...periods.flatMap((p) =>
        p.rateLines.map((r) =>
          this.pricingRed(
            'RATE_LINE',
            r.id,
            `${p.roomType} · ${r.boardType} · ${r.occupancy}`,
            r.price,
            marzaZa,
            provizijaZa,
          ),
        ),
      ),
      ...doplate.map((d) =>
        this.pricingRed(
          'ANCILLARY',
          d.id,
          d.name,
          d.flatAmount,
          marzaZa,
          provizijaZa,
          d.kind === 'DISCOUNT' ? 'popust' : 'doplata',
        ),
      ),
    ];

    stavke.sort(
      (a, b) => Number(b.jeIzuzetak) - Number(a.jeIzuzetak) || a.naziv.localeCompare(b.naziv, 'sr'),
    );
    return stavke;
  }

  private pricingRed(
    target: 'RATE_LINE' | 'ANCILLARY',
    targetId: string,
    naziv: string,
    osnovnaCena: number | null,
    marzaZa: Map<string, { percentage: unknown; fixedAmount: number | null }>,
    provizijaZa: Map<
      string,
      { noCommission: boolean; percentage: unknown; fixedAmount: number | null }
    >,
    vrsta?: string,
  ) {
    const m = marzaZa.get(targetId);
    const p = provizijaZa.get(targetId);
    return {
      target,
      targetId,
      naziv,
      vrsta: vrsta ?? null,
      osnovnaCena,
      markupPercentage: m?.percentage != null ? Number(m.percentage) : null,
      markupFixedAmount: m?.fixedAmount ?? null,
      noCommission: p?.noCommission ?? false,
      commissionPercentage: p?.percentage != null ? Number(p.percentage) : null,
      commissionFixedAmount: p?.fixedAmount ?? null,
      jeIzuzetak: Boolean(m || p),
    };
  }

  /**
   * Upis izuzetka za jednu stavku. Marža i provizija idu **zajedno, u jednoj transakciji** —
   * inače bi prekid između dva poziva ostavio stavku sa novom maržom i starom provizijom, a
   * to je stanje koje niko nije odabrao (zamka 7.9).
   */
  async upsertPricingRule(contractId: string, dto: UpsertPricingRuleDto, actorId: string) {
    const contract = await this.assertContract(contractId);
    await this.assertStavkaPripadaUgovoru(contractId, dto);

    const scopeType = dto.target === 'RATE_LINE' ? 'M3_RATE_LINE' : 'M3_ANCILLARY_SERVICE';
    const imaMarzu = dto.markupPercentage != null || dto.markupFixedAmount != null;
    const imaProviziju =
      dto.noCommission === true ||
      dto.commissionPercentage != null ||
      dto.commissionFixedAmount != null;

    if (!imaMarzu && !imaProviziju) {
      throw new BadRequestException(
        'Izuzetak mora nositi bar jednu vrednost — maržu ili proviziju. Prazan izuzetak ne znači ništa.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Jedan izuzetak po stavci: nov upis zamenjuje stari, ne staje pored njega. Dva pravila
      // istog dometa značila bi da iznos zavisi od redosleda čitanja iz baze.
      await tx.markupRule.deleteMany({ where: { scopeType, scopeId: dto.targetId } });
      if (imaMarzu) {
        await tx.markupRule.create({
          data: {
            scopeType,
            scopeId: dto.targetId,
            percentage: dto.markupPercentage ?? null,
            fixedAmount: dto.markupFixedAmount ?? null,
            fixedAmountCurrency:
              dto.markupFixedAmount != null ? (dto.markupCurrency ?? contract.currency) : null,
            activeFrom: dto.activeFrom ? dan(dto.activeFrom) : null,
            activeTo: dto.activeTo ? dan(dto.activeTo) : null,
            createdBy: actorId,
          },
        });
      }

      await tx.subagentCommissionOverride.deleteMany({
        where: { scopeType, scopeId: dto.targetId, subagentId: dto.subagentId ?? null },
      });
      if (imaProviziju) {
        await tx.subagentCommissionOverride.create({
          data: {
            subagentId: dto.subagentId ?? null,
            scopeType,
            scopeId: dto.targetId,
            noCommission: dto.noCommission ?? false,
            percentage: dto.commissionPercentage ?? null,
            fixedAmount: dto.commissionFixedAmount ?? null,
            activeFrom: dto.activeFrom ? dan(dto.activeFrom) : null,
            activeTo: dto.activeTo ? dan(dto.activeTo) : null,
            createdBy: actorId,
          },
        });
      }
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricing_rule.upserted',
      resourceType: dto.target === 'RATE_LINE' ? 'RateLine' : 'AncillaryService',
      resourceId: dto.targetId,
      context: {
        contractId,
        marza: imaMarzu
          ? { procenat: dto.markupPercentage ?? null, iznos: dto.markupFixedAmount ?? null }
          : null,
        provizija: imaProviziju
          ? {
              bez: dto.noCommission ?? false,
              procenat: dto.commissionPercentage ?? null,
              iznos: dto.commissionFixedAmount ?? null,
            }
          : null,
      },
    });
    return { ok: true };
  }

  /** Uklanjanje izuzetka — stavka se vraća na podrazumevano pravilo ugovora. */
  async deletePricingRule(contractId: string, dto: UpsertPricingRuleDto, actorId: string) {
    await this.assertStavkaPripadaUgovoru(contractId, dto);
    const scopeType = dto.target === 'RATE_LINE' ? 'M3_RATE_LINE' : 'M3_ANCILLARY_SERVICE';

    await this.prisma.$transaction(async (tx) => {
      await tx.markupRule.deleteMany({ where: { scopeType, scopeId: dto.targetId } });
      await tx.subagentCommissionOverride.deleteMany({
        where: { scopeType, scopeId: dto.targetId },
      });
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricing_rule.removed',
      resourceType: dto.target === 'RATE_LINE' ? 'RateLine' : 'AncillaryService',
      resourceId: dto.targetId,
      context: { contractId },
    });
    return { ok: true };
  }

  /** Stavka iz tuđeg ugovora bi napravila pravilo koje se nikad ne primeni, a izgleda ispravno. */
  private async assertStavkaPripadaUgovoru(contractId: string, dto: UpsertPricingRuleDto) {
    if (dto.target === 'RATE_LINE') {
      const r = await this.prisma.rateLine.findUnique({
        where: { id: dto.targetId },
        select: { contractPeriod: { select: { contractId: true } } },
      });
      if (!r || r.contractPeriod.contractId !== contractId) {
        throw new NotFoundException('Cenovna stavka nije pronađena u ovom ugovoru');
      }
    } else {
      const a = await this.prisma.ancillaryService.findUnique({
        where: { id: dto.targetId },
        select: { contractId: true },
      });
      if (!a || a.contractId !== contractId) {
        throw new NotFoundException('Doplata nije pronađena u ovom ugovoru');
      }
    }
  }

  // ──────────────────────────────────────────────────────────── pomoćno

  // ──────────────────────────────────────────────────────────── doplate i popusti (§2.11j/k)

  /**
   * Sve doplate i popusti jednog ugovora, sa razrešenim dometom.
   *
   * Čitaju se **svi** nivoi odjednom (ugovor + sezone + periodi) jer ekran prikazuje jednu
   * tabelu, ne tri. Zato `contract_id` stoji i na najužim stavkama — bez njega bi ovo bila
   * tri upita i spajanje u kodu.
   */
  async surcharges(contractId: string) {
    await this.assertContract(contractId);
    const stavke = await this.prisma.ancillaryService.findMany({
      where: { contractId, status: 'ACTIVE' },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    return stavke.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      pricingMode: s.pricingMode,
      flatAmount: s.flatAmount,
      percentageOfNightlyRate: s.percentageOfNightlyRate,
      priceBasis: s.priceBasis,
      payable: s.payable,
      isMandatory: s.isMandatory,
      // Prikaz mora reći da li stavka ulazi u zbir — vlasnikova odluka: ono što se plaća u
      // hotelu se prikazuje, ali ne fakturiše (§2.11j).
      ulaziUZbir: ulaziUZbir(s),
      domet: domet(s),
      seasonId: s.seasonId,
      contractPeriodId: s.contractPeriodId,
      appliesToRoomTypes: s.appliesToRoomTypes,
      appliesFrom: s.appliesFrom ? iso(s.appliesFrom) : null,
      appliesTo: s.appliesTo ? iso(s.appliesTo) : null,
      ageFrom: s.ageFrom != null ? Number(s.ageFrom) : null,
      ageTo: s.ageTo != null ? Number(s.ageTo) : null,
      bookingFrom: s.bookingFrom ? iso(s.bookingFrom) : null,
      bookingTo: s.bookingTo ? iso(s.bookingTo) : null,
      coversPersons: s.coversPersons,
      maxAdults: s.maxAdults,
      maxChildren: s.maxChildren,
      maxQuantity: s.maxQuantity,
      notes: s.notes,
    }));
  }

  async createSurcharge(contractId: string, dto: UpsertSurchargeDto, actorId: string) {
    await this.assertContract(contractId);

    // Način obračuna i iznos moraju da se slažu — bez ovoga bi stavka nastala bez ijedne cene
    // i tiho ne radila ništa pri obračunu.
    if (dto.pricingMode === 'FLAT_PER_UNIT' && dto.flatAmount == null) {
      throw new BadRequestException('Za obračun „fiksan iznos" mora se uneti iznos.');
    }
    if (dto.pricingMode === 'PERCENTAGE_OF_NIGHTLY_RATE' && dto.percentageOfNightlyRate == null) {
      throw new BadRequestException('Za obračun „procenat od cene" mora se uneti procenat.');
    }
    if (dto.ageFrom != null && dto.ageTo != null && dto.ageFrom > dto.ageTo) {
      throw new BadRequestException('Uzrast „od" ne može biti veći od uzrasta „do".');
    }

    // Domet se proverava, ne veruje: sezona ili period iz drugog ugovora bi napravili stavku
    // koja se nikad ne primeni, a na ekranu izgleda ispravno.
    if (dto.seasonId) await this.assertSeason(contractId, dto.seasonId);
    if (dto.contractPeriodId) {
      const p = await this.prisma.contractPeriod.findUnique({
        where: { id: dto.contractPeriodId },
      });
      if (!p || p.contractId !== contractId) {
        throw new NotFoundException('Period nije pronađen u ovom ugovoru');
      }
    }

    const stavka = await this.prisma.ancillaryService.create({
      data: {
        contractId,
        seasonId: dto.seasonId ?? null,
        contractPeriodId: dto.contractPeriodId ?? null,
        appliesToRoomTypes: dto.appliesToRoomTypes ?? [],
        appliesFrom: dto.appliesFrom ? dan(dto.appliesFrom) : null,
        appliesTo: dto.appliesTo ? dan(dto.appliesTo) : null,
        ageFrom: dto.ageFrom ?? null,
        ageTo: dto.ageTo ?? null,
        bookingFrom: dto.bookingFrom ? dan(dto.bookingFrom) : null,
        bookingTo: dto.bookingTo ? dan(dto.bookingTo) : null,
        name: dto.name,
        kind: dto.kind ?? 'SURCHARGE',
        pricingMode: dto.pricingMode,
        flatAmount: dto.flatAmount ?? null,
        percentageOfNightlyRate: dto.percentageOfNightlyRate ?? null,
        priceBasis: dto.priceBasis,
        payable: dto.payable ?? 'AGENCY',
        isMandatory: dto.isMandatory ?? false,
        coversPersons: dto.coversPersons ?? null,
        maxAdults: dto.maxAdults ?? null,
        maxChildren: dto.maxChildren ?? null,
        maxQuantity: dto.maxQuantity ?? null,
        notes: dto.notes ?? null,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'ancillary_service.created',
      resourceType: 'AncillaryService',
      resourceId: stavka.id,
      context: { contractId, name: stavka.name, kind: stavka.kind, domet: domet(stavka) },
    });
    return stavka;
  }

  /** Gašenje, ne brisanje (§2.4c) — stavka je finansijski podatak. */
  async deactivateSurcharge(contractId: string, id: string, actorId: string) {
    const stavka = await this.prisma.ancillaryService.findUnique({ where: { id } });
    if (!stavka || stavka.contractId !== contractId) {
      throw new NotFoundException('Stavka nije pronađena u ovom ugovoru');
    }
    if (stavka.status !== 'ACTIVE') {
      throw new BadRequestException('Stavka je već ugašena.');
    }

    await this.prisma.ancillaryService.update({
      where: { id },
      data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'ancillary_service.deactivated',
      resourceType: 'AncillaryService',
      resourceId: id,
      context: { contractId, name: stavka.name },
    });
    return { deactivated: true };
  }

  private async assertContract(contractId: string) {
    const c = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!c) throw new NotFoundException('Ugovor nije pronađen');
    return c;
  }

  private async assertSeason(contractId: string, seasonId: string) {
    const s = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { ranges: { orderBy: { dateFrom: 'asc' } } },
    });
    if (!s || s.contractId !== contractId) throw new NotFoundException('Sezona nije pronađena');
    return s;
  }

  private async assertOpseziIspravni(
    contractId: string,
    dto: UpsertSeasonDto,
    izuzmiSeasonId: string | null,
  ) {
    const ostale = await this.prisma.season.findMany({
      where: { contractId, ...(izuzmiSeasonId ? { NOT: { id: izuzmiSeasonId } } : {}) },
      include: { ranges: true },
    });
    const greska = proveriSezonu(
      { code: dto.code, ranges: dto.ranges },
      ostale.map((s) => ({ id: s.id, code: s.code, ranges: s.ranges })),
    );
    if (greska) throw new BadRequestException(greska.poruka);
  }

  private async sledeciRank(contractId: string): Promise<number> {
    const max = await this.prisma.season.aggregate({
      where: { contractId },
      _max: { rank: true },
    });
    return (max._max.rank ?? 0) + 1;
  }
}

export interface GridCell {
  price: number;
  rateLineIds: string[];
  periodIds: string[];
  bookingFrom: string | null;
  bookingTo: string | null;
  neslozno: boolean;
}

export interface GridRow {
  key: string;
  boardType: string;
  occupancy: string;
  priceBasis: PriceBasis;
  cells: Record<string, GridCell>;
}

export interface GridGrupa {
  roomType: string;
  rows: GridRow[];
  bezSezone: { periodId: string; stayFrom: string; stayTo: string; cenovnihRedova: number }[];
}

function redKljuc(boardType: string, occupancy: string, priceBasis: PriceBasis): string {
  return `${boardType}|${occupancy}|${priceBasis}`;
}

function dan(v: string | Date): Date {
  return new Date(danUtc(v));
}

function iso(v: Date): string {
  return v.toISOString().slice(0, 10);
}

function isteGranice(u: Date | null, dto: string | undefined): boolean {
  if (!u && !dto) return true;
  if (!u || !dto) return false;
  return danUtc(u) === danUtc(dto);
}
