import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceBasis } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { assertNoContractPeriodOverlap } from '../contract-periods/overlap';
import { danUtc, proveriSezonu } from './season-ranges';
import { UpsertSeasonDto } from './dto/upsert-season.dto';
import { WriteCellDto } from './dto/write-cell.dto';

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

  // ──────────────────────────────────────────────────────────── pomoćno

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
