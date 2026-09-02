import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';

/**
 * M5 spec §6 dopuna (2.9.2026, na zahtev vlasnika) — javan, neautentifikovan sadržaj vaučera.
 * Isti obrazac kao M23 `PublicKnowledgeController`/M12 `PublicContentController`: ODVOJEN,
 * negardiran kontroler — servisni sloj (`BookingsService.getVoucherContent`) fizički učitava
 * SAMO maskirane, dozvoljene podatke (§6.2) i SAMO kad je vaučer stvarno izdat, pa pogrešno
 * dodat guard ovde ne bi mogao slučajno izložiti nešto van toga.
 */
@ApiTags('sales-bookings-public')
@Controller('sales/bookings/public')
export class PublicVoucherController {
  constructor(private readonly bookings: BookingsService) {}

  @Get(':id/voucher')
  getVoucher(@Param('id') id: string) {
    return this.bookings.getVoucherContent(id);
  }
}
