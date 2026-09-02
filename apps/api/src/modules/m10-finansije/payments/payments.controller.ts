import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InitiateCardPaymentDto, CardPaymentWebhookDto } from './dto/card-payment.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { verifyPaymentWebhookSignature } from './payment-webhook-signature';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-payments')
@Controller('finance/payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'VIEW')
  findAll(@Query('bookingId') bookingId: string | undefined) {
    return this.payments.findAll({ bookingId });
  }

  // Dopuna (2.9.2026) — pregled/štampa specifikacije čekova (kartica "Specifikacija čekova").
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.payments.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'RECORD')
  recordManualPayment(@Body() dto: RecordPaymentDto, @CurrentUser() actor: { userId: string }) {
    return this.payments.recordManualPayment(dto, actor);
  }

  // Dopuna (2.9.2026, na zahtev vlasnika) — korekcija ručno unete uplate (npr. greška pri
  // kucanju specifikacije čekova). Ista dozvola kao unos; servis blokira kad je fiskalni
  // dokument za tu rezervaciju već SUBMITTED/ISSUED, i nikad ne dozvoljava CARD (webhook tok).
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('M10', 'payment', 'RECORD')
  updateManualPayment(@Param('id') id: string, @Body() dto: UpdatePaymentDto, @CurrentUser() actor: { userId: string }) {
    return this.payments.updateManualPayment(id, dto, actor);
  }

  // §7.2 korak 1 — pokreće gost, samostalno na sajtu (isti autentikacioni nivo kao ostatak M8/M5
  // samouslužnog toka, ne zahteva internu M1/M10 dozvolu).
  @Post('card/initiate')
  initiateCardPayment(@Body() dto: InitiateCardPaymentDto) {
    return this.payments.initiateCardPayment(dto.quoteId, dto.idempotencyKey);
  }

  // §7.2 korak 2 — povratni poziv platnog provajdera, jedini način na koji se CARD uplata
  // beleži kao RECEIVED (§5.2, §9) — bez interne M1 autentikacije (provajder nema naš token,
  // isti obrazac kao svaki pravi PSP webhook), ALI sa obaveznim potpisom (bezbednosni nalaz,
  // 28.8.2026, pre lansiranja pregled) — bez ovoga bi bilo ko ko sazna/izračuna
  // `gatewayTransactionId` mogao da potvrdi rezervaciju kao plaćenu bez ijednog dinara.
  @Post('card/webhook')
  handleCardWebhook(@Body() dto: CardPaymentWebhookDto, @Headers('x-payment-webhook-signature') signature?: string) {
    const secret = this.config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
    if (!verifyPaymentWebhookSignature(dto.gatewayTransactionId, signature, secret)) {
      throw new UnauthorizedException('Nevažeći ili nedostajući potpis webhook poziva.');
    }
    return this.payments.handleCardWebhook(dto.gatewayTransactionId, dto);
  }
}
