import { BadRequestException, Injectable } from '@nestjs/common';
import { AgeCategory, AgePricingMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreatePricelistImportDto } from './dto/create-pricelist-import.dto';
import { ReviewRowDto } from './dto/review-row.dto';
import { assertNoContractPeriodOverlap } from '../contract-periods/overlap';

@Injectable()
export class PricelistImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.pricelistImport.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.pricelistImport.findUniqueOrThrow({ where: { id }, include: { rows: true } });
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
   * M3 spec §4.2.4 — "Kreiranje ili izmena stvarnog ContractPeriod/RateLine zapisa iz
   * potvrđenog reda je nivo 'Predloži pa čovek odobri'". CONFIRMED/MANUALLY_MATCHED oba
   * zahtevaju razrešen `matchedProductId` (AI predlog potvrđen, ili ručno izabran ovde) —
   * bez proizvoda se ne zna kom Contract-u period pripada (Product.sourceContractId).
   */
  async reviewRow(importId: string, rowId: string, dto: ReviewRowDto, actorId: string) {
    const row = await this.prisma.pricelistImportRow.findUniqueOrThrow({
      where: { id: rowId },
      include: { import: true },
    });
    if (row.import.id !== importId) {
      throw new BadRequestException('Stavka ne pripada navedenom uvozu');
    }

    if (dto.decision === 'REJECTED') {
      const rejected = await this.prisma.pricelistImportRow.update({
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
      return rejected;
    }

    const matchedProductId = dto.matchedProductId ?? row.matchedProductId;
    if (!matchedProductId) {
      throw new BadRequestException('Red mora imati matched_product_id pre odobrenja (M3 spec §4.2.3/§4.2.4)');
    }
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: matchedProductId } });
    if (!product.sourceContractId) {
      throw new BadRequestException('Poklopljeni proizvod nema source_contract_id — nije CONTRACTED proizvod');
    }
    if (!row.extractedPriceBasis) {
      throw new BadRequestException(
        'extracted_price_basis nije prepoznat — ne može se pretpostaviti PER_ROOM/PER_PERSON (M3 spec §2.4)',
      );
    }

    await assertNoContractPeriodOverlap(
      this.prisma,
      product.sourceContractId,
      row.extractedRoomType,
      row.extractedStayFrom,
      row.extractedStayTo,
    );

    // Cenovnik sam po sebi ne nosi kapacitet (to je zaseban dogovor o alotmanu) —
    // ON_REQUEST je jedini bezbedan podrazumevani mod: ne pretpostavlja kapacitet koji
    // dokument ne navodi (M3 spec §2.3, "ON_REQUEST period nema total_capacity").
    const period = await this.prisma.contractPeriod.create({
      data: {
        contractId: product.sourceContractId,
        stayFrom: row.extractedStayFrom,
        stayTo: row.extractedStayTo,
        roomType: row.extractedRoomType,
        allotmentMode: 'ON_REQUEST',
      },
    });

    const agePricingCandidates = (row.extractedAgePricing ?? []) as unknown as {
      age_category: string;
      occupant_index?: number;
      min_adults_present?: number;
      pricing_mode: string;
      percentage?: number;
      flat_price?: number;
    }[];

    const rateLine = await this.prisma.rateLine.create({
      data: {
        contractPeriodId: period.id,
        boardType: row.extractedBoardType,
        occupancy: row.extractedOccupancy,
        priceBasis: row.extractedPriceBasis,
        price: row.extractedPrice,
        cribFeePerNight: row.extractedCribFeePerNight,
        agePricing: agePricingCandidates.length
          ? {
              create: agePricingCandidates.map((a) => ({
                ageCategory: a.age_category as AgeCategory,
                occupantIndex: a.occupant_index,
                minAdultsPresent: a.min_adults_present,
                pricingMode: a.pricing_mode as AgePricingMode,
                percentage: a.percentage,
                flatPrice: a.flat_price,
              })),
            }
          : undefined,
      },
    });

    const updatedRow = await this.prisma.pricelistImportRow.update({
      where: { id: rowId },
      data: { reviewStatus: dto.decision, reviewedBy: actorId, matchedProductId },
    });

    // §4.2.5 — "tiho ažurira SupplierExtractionProfile ... potvrđenim vrednostima", ista
    // akcija koja već postoji, bez novog koraka za zaposlenog.
    await this.prisma.supplierExtractionProfile.upsert({
      where: { supplierId: row.import.supplierId },
      create: {
        supplierId: row.import.supplierId,
        typicalPriceBasis: row.extractedPriceBasis,
        typicalAgeThresholds: row.extractedAgePricing ?? undefined,
        lastConfirmedImportId: importId,
      },
      update: {
        typicalPriceBasis: row.extractedPriceBasis,
        typicalAgeThresholds: row.extractedAgePricing ?? undefined,
        lastConfirmedImportId: importId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_import_row.approved',
      resourceType: 'PricelistImportRow',
      resourceId: rowId,
      afterState: { decision: dto.decision, contractPeriodId: period.id, rateLineId: rateLine.id },
      context: { importId },
    });

    await this.maybeComplete(importId);
    return updatedRow;
  }

  private async maybeComplete(importId: string) {
    const pending = await this.prisma.pricelistImportRow.count({
      where: { pricelistImportId: importId, reviewStatus: 'PENDING' },
    });
    if (pending === 0) {
      await this.prisma.pricelistImport.update({ where: { id: importId }, data: { status: 'COMPLETED' } });
    }
  }
}
