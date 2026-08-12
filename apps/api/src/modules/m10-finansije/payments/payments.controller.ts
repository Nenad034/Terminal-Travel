import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitiateCardPaymentDto, CardPaymentWebhookDto } from './dto/card-payment.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-payments')
@Controller('finance/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'VIEW')
  findAll(@Query('bookingId') bookingId: string | undefined) {
    return this.payments.findAll({ bookingId });
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'RECORD')
  recordManualPayment(@Body() dto: RecordPaymentDto, @CurrentUser() actor: { userId: string }) {
    return this.payments.recordManualPayment(dto, actor);
  }

  // §7.2 korak 1 — pokreće gost, samostalno na sajtu (isti autentikacioni nivo kao ostatak M8/M5
  // samouslužnog toka, ne zahteva internu M1/M10 dozvolu).
  @Post('card/initiate')
  initiateCardPayment(@Body() dto: InitiateCardPaymentDto) {
    return this.payments.initiateCardPayment(dto.quoteId, dto.idempotencyKey);
  }

  // §7.2 korak 2 — povratni poziv platnog provajdera, jedini način na koji se CARD uplata
  // beleži kao RECEIVED (§5.2, §9) — bez interne M1 autentikacije, provajder nema naš token.
  @Post('card/webhook')
  handleCardWebhook(@Body() dto: CardPaymentWebhookDto) {
    return this.payments.handleCardWebhook(dto.gatewayTransactionId, dto);
  }
}
