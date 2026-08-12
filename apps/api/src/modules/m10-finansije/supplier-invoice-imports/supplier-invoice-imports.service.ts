import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CreateSupplierInvoiceImportDto } from './dto/create-import.dto';
import { ConfirmSupplierInvoiceRowDto } from './dto/confirm-row.dto';

// M10 spec §8.6 — AI uvoz ulaznih faktura dobavljača, isti obrazac kao M3 PricelistImport.
@Injectable()
export class SupplierInvoiceImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  findAll() {
    return this.prisma.supplierInvoiceImport.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.supplierInvoiceImport.findUnique({ where: { id }, include: { rows: true } });
    if (!record) throw new NotFoundException(`SupplierInvoiceImport ${id} nije pronađen.`);
    return record;
  }

  // §8.6.1 — status ostaje PROCESSING: stvarna AI ekstrakcija (OCR/parsiranje) čeka odluku o
  // AI provajderu koja još nije doneta — isti gap kao M3 PricelistImport §4.2.1 (nepovezano
  // namerno, ne propust). Kad se poveže, ekstrakcija kreira SupplierInvoiceImportRow zapise i
  // predlaže mapiranje preko findBestSupplierObligationMatch (matching.ts, §8.6.3), već testirano.
  async create(dto: CreateSupplierInvoiceImportDto, actor: { userId: string }) {
    const record = await this.prisma.supplierInvoiceImport.create({
      data: { supplierId: dto.supplierId, sourceFileUrl: dto.sourceFileUrl, sourceFormat: dto.sourceFormat, status: 'PROCESSING', createdBy: actor.userId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_invoice_import.created',
      resourceType: 'SupplierInvoiceImport',
      resourceId: record.id,
      afterState: record,
    });
    return record;
  }

  // §8.6.4 — upis potvrđenog reda u SupplierObligation.invoice_reference, uz eventualnu korekciju
  // iznosa i ponovni izračun kursa na dan prijema fakture; nivo "Predloži pa čovek odobri".
  async confirmRow(importId: string, rowId: string, dto: ConfirmSupplierInvoiceRowDto, actor: { userId: string }) {
    const row = await this.prisma.supplierInvoiceImportRow.findUnique({ where: { id: rowId } });
    if (!row || row.supplierInvoiceImportId !== importId) {
      throw new NotFoundException(`Red ${rowId} ne pripada uvozu ${importId}.`);
    }

    const targetObligationId = dto.matchedSupplierObligationId ?? row.matchedSupplierObligationId;
    if (!targetObligationId) {
      throw new BadRequestException('Red nema matched_supplier_obligation_id — potreban je predlog ili ručno zadat cilj (M10 spec §8.6.3/§8.6.4).');
    }

    const obligation = await this.prisma.supplierObligation.findUnique({ where: { id: targetObligationId } });
    if (!obligation) throw new NotFoundException(`SupplierObligation ${targetObligationId} nije pronađena.`);

    const finalAmount = dto.correctedAmount ?? row.extractedAmount;
    const rateAtInvoice = obligation.currencyOriginal !== 'RSD'
      ? await this.exchangeRates.findForCurrencyOnOrBefore(obligation.currencyOriginal, new Date())
      : null;
    const amountRsdAtInvoice = rateAtInvoice ? Math.round(finalAmount * Number(rateAtInvoice.nbsMiddleRate)) : finalAmount;

    const updatedObligation = await this.prisma.supplierObligation.update({
      where: { id: targetObligationId },
      data: {
        invoiceReference: row.extractedInvoiceReference,
        amountOriginal: finalAmount,
        exchangeRateSnapshotIdAtInvoice: rateAtInvoice?.id,
        amountRsdAtInvoice,
      },
    });

    const isManual = dto.matchedSupplierObligationId != null && dto.matchedSupplierObligationId !== row.matchedSupplierObligationId;
    const updatedRow = await this.prisma.supplierInvoiceImportRow.update({
      where: { id: rowId },
      data: {
        reviewStatus: isManual ? 'MANUALLY_MATCHED' : 'CONFIRMED',
        reviewedBy: actor.userId,
        matchedSupplierObligationId: targetObligationId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_invoice_import_row.confirmed',
      resourceType: 'SupplierInvoiceImportRow',
      resourceId: rowId,
      afterState: { row: updatedRow, obligation: updatedObligation },
    });

    await this.maybeComplete(importId);
    return updatedRow;
  }

  async rejectRow(importId: string, rowId: string, actor: { userId: string }) {
    const row = await this.prisma.supplierInvoiceImportRow.findUnique({ where: { id: rowId } });
    if (!row || row.supplierInvoiceImportId !== importId) {
      throw new NotFoundException(`Red ${rowId} ne pripada uvozu ${importId}.`);
    }
    const updated = await this.prisma.supplierInvoiceImportRow.update({
      where: { id: rowId },
      data: { reviewStatus: 'REJECTED', reviewedBy: actor.userId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_invoice_import_row.rejected',
      resourceType: 'SupplierInvoiceImportRow',
      resourceId: rowId,
    });
    await this.maybeComplete(importId);
    return updated;
  }

  private async maybeComplete(importId: string) {
    const pending = await this.prisma.supplierInvoiceImportRow.count({
      where: { supplierInvoiceImportId: importId, reviewStatus: 'PENDING' },
    });
    if (pending === 0) {
      await this.prisma.supplierInvoiceImport.update({ where: { id: importId }, data: { status: 'COMPLETED' } });
    }
  }
}
