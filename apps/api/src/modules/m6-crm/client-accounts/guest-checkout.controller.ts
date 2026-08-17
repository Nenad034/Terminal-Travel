import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { GuestCheckoutService } from './guest-checkout.service';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';

// M8 spec poglavlje 3, korak 3 (dopuna avgust 2026) — namerno BEZ JwtAuthGuard/
// PermissionsGuard, isti autentikacioni nivo kao M10 PaymentsController
// `card/initiate`/`card/webhook` (§7.2) i M1 `POST /iam/auth/register` — anoniman
// gost, samo strogo ograničen rate limitom (5/sat po IP, sprečava
// spam/zloupotrebu M1 registracije iza ovog endpoint-a; globalni throttler
// (app.module.ts) je 100/min, ovaj endpoint je namerno stroži jer stvara nalog).
// Poseban kontroler (ne metoda u ClientAccountsController) da izbegne class-level
// JwtAuthGuard/PermissionsGuard tog kontrolera.
@ApiTags('crm-client-accounts')
@Controller('crm/client-accounts')
export class GuestCheckoutController {
  constructor(private readonly guestCheckout: GuestCheckoutService) {}

  @Post('guest-checkout')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  checkout(@Body() dto: GuestCheckoutDto) {
    return this.guestCheckout.checkout(dto);
  }
}
