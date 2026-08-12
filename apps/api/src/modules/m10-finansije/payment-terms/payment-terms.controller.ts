import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentTermsConfigService } from './payment-terms-config.service';
import { ClientPaymentSchedulesService } from './client-payment-schedules.service';
import { UpdatePaymentTermsDto } from './dto/update-payment-terms.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-payment-terms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class PaymentTermsController {
  constructor(
    private readonly paymentTerms: PaymentTermsConfigService,
    private readonly clientPaymentSchedules: ClientPaymentSchedulesService,
  ) {}

  @Get('payment-terms-config')
  @RequirePermission('M10', 'payment-terms-config', 'VIEW')
  getActive() {
    return this.paymentTerms.getActive();
  }

  @Put('payment-terms-config')
  @RequirePermission('M10', 'payment-terms-config', 'EDIT')
  update(@Body() dto: UpdatePaymentTermsDto, @CurrentUser() actor: { userId: string }) {
    return this.paymentTerms.update(dto, actor);
  }

  @Get('client-payment-schedules')
  @RequirePermission('M10', 'client-payment-schedule', 'VIEW')
  findAll(@Query('bookingId') bookingId: string | undefined) {
    return this.clientPaymentSchedules.findAll({ bookingId });
  }
}
