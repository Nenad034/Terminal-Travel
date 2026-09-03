import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
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

  /**
   * §6 dopuna (3.9.2026) — bez parametara vraća SVE vaučere rezervacije, po jedan po
   * dobavljaču (vlasnikova odluka: objedinjen po dobavljaču je podrazumevani).
   *
   * `?stavka=<itemId>` je opcija „pojedinačni vaučer po usluzi" — postoji stvaran slučaj gde
   * treba (transfer koji gost koristi u drugom gradu, u drugom terminu).
   */
  @Get(':id/voucher')
  getVoucher(@Param('id') id: string, @Query('stavka') itemId?: string) {
    return this.bookings.getVoucherContent(id, itemId ? { itemId } : {});
  }

  /**
   * Jedan vaučer — redni broj grupe UNUTAR ove rezervacije (1, 2, 3…), ne `supplier_id`.
   * Namerno: UUID dobavljača je isti kroz sve rezervacije i time upotrebljiv za povezivanje,
   * a §6.2 zabranjuje da identitet dobavljača na bilo koji način stigne do gosta.
   */
  @Get(':id/voucher/:groupIndex')
  getVoucherGroup(@Param('id') id: string, @Param('groupIndex') groupIndex: string) {
    const index = Number(groupIndex);
    if (!Number.isInteger(index) || index < 1) throw new BadRequestException('Redni broj vaučera mora biti ceo broj veći od nule.');
    return this.bookings.getVoucherContent(id, { groupIndex: index });
  }
}
