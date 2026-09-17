import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OfferExpiryService } from './offer-expiry.service';
import { ExpiryNoticesQueryDto } from './dto/expiry-notices-query.dto';

/**
 * M3 spec §4.9 / §6 — akcije pred istek. Dozvole su iste kao za ugovor (`M3/contract`):
 * ko sme da vidi ugovor sme da vidi da mu akcija ističe, ko sme da ga menja sme i da potvrdi
 * da je video — nova dozvola bi tražila dodelu po korisniku za isti posao.
 */
@ApiTags('contracting-pricelist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting/pricelist/expiry-notices')
export class OfferExpiryController {
  constructor(private readonly offerExpiry: OfferExpiryService) {}

  @Get()
  @RequirePermission('M3', 'contract', 'VIEW')
  list(@Query() q: ExpiryNoticesQueryDto) {
    return this.offerExpiry.list(q);
  }

  /** Ugovarač potvrđuje da je video — red nestaje iz radnog spiska (§4.9.2, prag `INTERNAL`). */
  @Post(':id/acknowledge')
  @RequirePermission('M3', 'contract', 'EDIT')
  acknowledge(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.offerExpiry.acknowledge(id, actor.userId);
  }

  /**
   * Ručno pokretanje dnevnog posla — za proveru na živom sistemu i za dan kad server nije radio
   * (posao inače ide sam, `M3DailyJobsService`). Idempotentno: drugi poziv istog dana ne pravi
   * drugi zapis (§4.9.2, jedinstvenost po stavci i pragu).
   */
  @Post('run')
  @RequirePermission('M3', 'contract', 'EDIT')
  run() {
    return this.offerExpiry.runDaily();
  }
}
