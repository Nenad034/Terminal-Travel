import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CreateSupplierObligationDto } from './dto/create-supplier-obligation.dto';
import { PaySupplierObligationDto } from './dto/pay-supplier-obligation.dto';

const DEFAULT_PAYMENT_TERMS_DAYS = 30; // M3 spec §2.2 — kad Contract.payment_terms_days nije uneto

// M10 spec §8 — obaveze prema dobavljačima (payables), simetrično §5.2 potraživanjima od gostiju.
@Injectable()
export class SupplierObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  // §8.0 — automatski okidač po booking.confirmed za CONTRACTED stavke sa item_status=CONFIRMED.
  async createFromBookingItem(bookingItemId: string) {
    const existing = await this.prisma.supplierObligation.findFirst({ where: { bookingItemId } });
    if (existing) return existing;

    const item = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!item || item.sourceType !== 'CONTRACTED') return null;

    const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
    if (!product?.sourceContractId) return null;

    const contract = await this.prisma.contract.findUnique({ where: { id: product.sourceContractId } });
    if (!contract) return null;

    const dueDate = addDays(new Date(), contract.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS);

    const obligation = await this.prisma.supplierObligation.create({
      data: {
        supplierId: contract.supplierId,
        bookingItemId: item.id,
        amountOriginal: item.baseCost,
        currencyOriginal: item.baseCostCurrency,
        dueDate,
        status: 'PENDING',
      },
    });

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M10',
      action: 'supplier_obligation.auto_created',
      resourceType: 'SupplierObligation',
      resourceId: obligation.id,
      afterState: obligation,
    });

    return obligation;
  }

  async create(dto: CreateSupplierObligationDto, actor: { userId: string }) {
    const obligation = await this.prisma.supplierObligation.create({
      data: {
        supplierId: dto.supplierId,
        bookingItemId: dto.bookingItemId,
        amountOriginal: dto.amountOriginal,
        currencyOriginal: dto.currencyOriginal,
        dueDate: new Date(dto.dueDate),
        status: 'PENDING',
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_obligation.created',
      resourceType: 'SupplierObligation',
      resourceId: obligation.id,
      afterState: obligation,
    });
    return obligation;
  }

  async findAll(filters: { supplierId?: string; status?: string }) {
    return this.prisma.supplierObligation.findMany({
      where: { supplierId: filters.supplierId, status: filters.status as any },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const obligation = await this.prisma.supplierObligation.findUnique({ where: { id } });
    if (!obligation) throw new NotFoundException(`SupplierObligation ${id} nije pronađena.`);
    return obligation;
  }

  // §8.3 — mora imati popunjen booking_item_id pre APPROVED; isključivo ljudska radnja.
  async approve(id: string, actor: { userId: string }) {
    const obligation = await this.findOne(id);
    if (!obligation.bookingItemId) {
      throw new BadRequestException('SupplierObligation nema popunjen bookingItemId — ne može preći u APPROVED (M10 spec §8.3).');
    }
    if (obligation.status !== 'PENDING') {
      throw new BadRequestException(`SupplierObligation ${id} nije u statusu PENDING (status: ${obligation.status}).`);
    }

    const updated = await this.prisma.supplierObligation.update({ where: { id }, data: { status: 'APPROVED' } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_obligation.approved',
      resourceType: 'SupplierObligation',
      resourceId: id,
      beforeState: obligation,
      afterState: updated,
    });
    return updated;
  }

  // §8.1 — pri plaćanju izračunava exchange_rate_difference ako se kurs na dan fakture
  // razlikuje od kursa na dan plaćanja.
  async pay(id: string, dto: PaySupplierObligationDto, actor: { userId: string }) {
    const obligation = await this.findOne(id);
    if (obligation.status !== 'APPROVED') {
      throw new BadRequestException(`SupplierObligation ${id} nije u statusu APPROVED (status: ${obligation.status}).`);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    let exchangeRateSnapshotIdAtPayment: string | null = null;
    let exchangeRateDifference: number | null = null;

    if (obligation.currencyOriginal !== 'RSD') {
      const rateAtPayment = await this.exchangeRates.findForCurrencyOnOrBefore(obligation.currencyOriginal, paidAt);
      exchangeRateSnapshotIdAtPayment = rateAtPayment.id;

      if (obligation.exchangeRateSnapshotIdAtInvoice) {
        const rateAtInvoice = await this.prisma.exchangeRateSnapshot.findUniqueOrThrow({
          where: { id: obligation.exchangeRateSnapshotIdAtInvoice },
        });
        const diff = Number(rateAtPayment.nbsMiddleRate) - Number(rateAtInvoice.nbsMiddleRate);
        exchangeRateDifference = Math.round(diff * obligation.amountOriginal);
      }
    }

    const updated = await this.prisma.supplierObligation.update({
      where: { id },
      data: { status: 'PAID', paidAt, exchangeRateSnapshotIdAtPayment, exchangeRateDifference },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_obligation.paid',
      resourceType: 'SupplierObligation',
      resourceId: id,
      beforeState: obligation,
      afterState: updated,
    });
    return updated;
  }

  // §8.2 — alarm 5 dana pre due_date ako status još nije PAID; poziva se periodično (@Cron).
  async findDueSoon(daysBefore = 5) {
    const threshold = addDays(new Date(), daysBefore);
    return this.prisma.supplierObligation.findMany({
      where: { status: { not: 'PAID' }, dueDate: { lte: threshold } },
    });
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
