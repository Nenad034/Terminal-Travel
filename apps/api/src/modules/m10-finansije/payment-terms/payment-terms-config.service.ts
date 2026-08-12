import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { UpdatePaymentTermsDto } from './dto/update-payment-terms.dto';

// M10 spec §5.4.1 — jedan aktivan zapis (singleton, sistem uvek čita najnoviji updated_at).
@Injectable()
export class PaymentTermsConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getActive() {
    const config = await this.prisma.paymentTermsConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!config) {
      throw new NotFoundException('Politika akontacije/balansa (PaymentTermsConfig) još nije podešena (M10 spec §5.4.1).');
    }
    return config;
  }

  async update(dto: UpdatePaymentTermsDto, actor: { userId: string }) {
    const created = await this.prisma.paymentTermsConfig.create({
      data: {
        depositPercentage: dto.depositPercentage,
        depositDueDaysAfterConfirmation: dto.depositDueDaysAfterConfirmation,
        balanceDueDaysBeforeStay: dto.balanceDueDaysBeforeStay,
        escalationDaysAfterDue: dto.escalationDaysAfterDue,
        updatedBy: actor.userId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'payment_terms_config.updated',
      resourceType: 'PaymentTermsConfig',
      resourceId: created.id,
      afterState: created,
    });
    return created;
  }
}
