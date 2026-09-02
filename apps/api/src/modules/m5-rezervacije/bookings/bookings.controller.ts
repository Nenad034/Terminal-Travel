import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ModifyBookingDto } from './dto/modify-booking.dto';
import { UpdatePaymentStatusDto } from './dto/payment-status.dto';
import { VoucherOverrideDto } from './dto/voucher-override.dto';
import { AssignGuideDto } from './dto/assign-guide.dto';
import { CreateBookingItemGuestDto } from './dto/create-booking-item-guest.dto';
import { UpdateBookingItemGuestDto } from './dto/update-booking-item-guest.dto';
import { PrepareSupplierManifestsDto } from './dto/prepare-supplier-manifests.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { ProposeHandoffDto } from './dto/propose-handoff.dto';
import { SupplierManifestsService } from '../supplier-manifests/supplier-manifests.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §11, prefiks /api/v1/sales
@ApiTags('sales-bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly supplierManifests: SupplierManifestsService,
  ) {}

  // M5 spec v1.54 (24.8.2026, na zahtev vlasnika — prava "Lista rezervacija") — v1 skup pravih
  // filtera, isključivo primenjen za INTERNAL_PANEL kontekst (poglavlje 6.2 ograda ostaje
  // netaknuta za B2C/B2B/gost kontekst, ovi parametri se za njih ignorišu u servisu).
  @Get()
  @RequirePermission('M5', 'booking', 'VIEW')
  findAll(
    @Query('status') status: string | string[] | undefined,
    @Query('channel') channel: string | undefined,
    @Query('clientAccountId') clientAccountId: string | undefined,
    @Query('paymentStatus') paymentStatus: string | string[] | undefined,
    @Query('tipNastupanja') tipNastupanja: string | string[] | undefined,
    @Query('buyerName') buyerName: string | undefined,
    @Query('bookingNumber') bookingNumber: string | undefined,
    @Query('currency') currency: string | undefined,
    @Query('createdFrom') createdFrom: string | undefined,
    @Query('createdTo') createdTo: string | undefined,
    @Query('stayFrom') stayFrom: string | undefined,
    @Query('stayTo') stayTo: string | undefined,
    @Query('returnFrom') returnFrom: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Query('productType') productType: string | string[] | undefined,
    @Query('productId') productId: string | undefined,
    @Query('destinationCity') destinationCity: string | undefined,
    @Query('destinationCountry') destinationCountry: string | undefined,
    @Query('hasTravelGuarantee') hasTravelGuarantee: string | undefined,
    @CurrentUser() actor: { userId: string },
  ) {
    // Multiselect (24.8.2026, na zahtev vlasnika) — NestJS `@Query` vraća string kad je
    // parametar prisutan jednom, niz kad je ponovljen (`?status=A&status=B`). Normalizuje se
    // ovde na uvek-niz pre prosleđivanja servisu, koji dalje ne mora da razlikuje oblike.
    const toArray = (v: string | string[] | undefined): string[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
    return this.bookings.findAll(
      {
        status: toArray(status),
        channel,
        clientAccountId,
        paymentStatus: toArray(paymentStatus),
        tipNastupanja: toArray(tipNastupanja),
        buyerName,
        bookingNumber,
        currency,
        createdFrom,
        createdTo,
        stayFrom,
        stayTo,
        returnFrom,
        returnTo,
        productType: toArray(productType),
        productId,
        destinationCity,
        destinationCountry,
        hasTravelGuarantee,
      },
      actor,
    );
  }

  // Isti v1 filter-skup kao `GET /sales/bookings` (iznad), BEZ datumskih opsega — vidi komentar
  // uz `buildCalendarItemWhere` u servisu. Dopuna 27.8.2026, na zahtev vlasnika: "Dodati filtere
  // koji postoje u Listi rezervacija" u novi kalendar (M17 spec, Google Calendar stil).
  @Get('calendar-summary')
  @RequirePermission('M5', 'booking', 'VIEW')
  calendarSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status: string | string[] | undefined,
    @Query('paymentStatus') paymentStatus: string | string[] | undefined,
    @Query('tipNastupanja') tipNastupanja: string | string[] | undefined,
    @Query('buyerName') buyerName: string | undefined,
    @Query('bookingNumber') bookingNumber: string | undefined,
    @Query('currency') currency: string | undefined,
    @Query('createdFrom') createdFrom: string | undefined,
    @Query('createdTo') createdTo: string | undefined,
    @Query('productType') productType: string | string[] | undefined,
    @Query('productId') productId: string | undefined,
    @Query('destinationCity') destinationCity: string | undefined,
    @Query('destinationCountry') destinationCountry: string | undefined,
    @Query('hasTravelGuarantee') hasTravelGuarantee: string | undefined,
  ) {
    const toArray = (v: string | string[] | undefined): string[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
    return this.bookings.calendarSummary(new Date(from), new Date(to), {
      status: toArray(status),
      paymentStatus: toArray(paymentStatus),
      tipNastupanja: toArray(tipNastupanja),
      buyerName,
      bookingNumber,
      currency,
      createdFrom,
      createdTo,
      productType: toArray(productType),
      productId,
      destinationCity,
      destinationCountry,
      hasTravelGuarantee,
    });
  }

  @Get('calendar/:date')
  @RequirePermission('M5', 'booking', 'VIEW')
  calendarDay(
    @Param('date') date: string,
    @Query('status') status: string | string[] | undefined,
    @Query('paymentStatus') paymentStatus: string | string[] | undefined,
    @Query('tipNastupanja') tipNastupanja: string | string[] | undefined,
    @Query('buyerName') buyerName: string | undefined,
    @Query('bookingNumber') bookingNumber: string | undefined,
    @Query('currency') currency: string | undefined,
    @Query('createdFrom') createdFrom: string | undefined,
    @Query('createdTo') createdTo: string | undefined,
    @Query('productType') productType: string | string[] | undefined,
    @Query('productId') productId: string | undefined,
    @Query('destinationCity') destinationCity: string | undefined,
    @Query('destinationCountry') destinationCountry: string | undefined,
    @Query('hasTravelGuarantee') hasTravelGuarantee: string | undefined,
  ) {
    const toArray = (v: string | string[] | undefined): string[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
    return this.bookings.calendarDay(new Date(date), {
      status: toArray(status),
      paymentStatus: toArray(paymentStatus),
      tipNastupanja: toArray(tipNastupanja),
      buyerName,
      bookingNumber,
      currency,
      createdFrom,
      createdTo,
      productType: toArray(productType),
      productId,
      destinationCity,
      destinationCountry,
      hasTravelGuarantee,
    });
  }

  @Get(':id')
  @RequirePermission('M5', 'booking', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    // §6.2 dopuna (avgust 2026) — kontekst (INTERNAL_PANEL/B2C/B2B) i vlasništvo se
    // učitavaju uživo po pozivaocu unutar servisa, ne prosleđuju se odavde.
    return this.bookings.findOne(id, actor.userId);
  }

  // Dopuna (23.8.2026, na zahtev vlasnika — vidi BookingsService.history() komentar) — ista
  // dozvola kao pregled same rezervacije, nema poseban gate.
  @Get(':id/history')
  @RequirePermission('M5', 'booking', 'VIEW')
  history(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.history(id, actor.userId);
  }

  @Post(':id/modify')
  @RequirePermission('M5', 'booking', 'MODIFY')
  modify(@Param('id') id: string, @Body() dto: ModifyBookingDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.modify(id, dto, actor);
  }

  // Dopuna (2.9.2026, na zahtev vlasnika — kartica Aranžman: "promena usluge/datuma uz
  // prethodnu proveru cene") — isti ulaz kao `modify`, ali ništa ne izvršava, samo računa novu
  // cenu za prikaz pre nego što čovek potvrdi. Ista dozvola kao stvarna izmena — pregled cene
  // otkriva iste podatke (npr. koje su usluge dostupne) koje bi otkrila i sama izmena.
  @Post(':id/modify/preview')
  @RequirePermission('M5', 'booking', 'MODIFY')
  previewModify(@Param('id') id: string, @Body() dto: ModifyBookingDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.previewModify(id, dto, actor);
  }

  @Post(':id/cancel')
  @RequirePermission('M5', 'booking', 'CANCEL')
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.cancel(id, dto, actor);
  }

  @Patch(':id/payment-status')
  @RequirePermission('M5', 'booking', 'MODIFY')
  updatePaymentStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.updatePaymentStatus(id, dto.paymentStatus, actor);
  }

  // M5 spec §4.2 dopuna (M9 spec §4) — dodela vodiča na terenu; interni panel (M17) je
  // nameravani pozivalac, dok M17 ne postoji ova ruta je zamena. Ista dozvola kao ostale
  // izmene rezervacije (booking/MODIFY) — nema poseban ključ, nije eksplicitno tražen u spec.
  @Patch('items/:itemId/assign-guide')
  @RequirePermission('M5', 'booking', 'MODIFY')
  assignGuide(@Param('itemId') itemId: string, @Body() dto: AssignGuideDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.assignGuide(itemId, dto.assignedGuideId ?? null, actor);
  }

  // M5 spec §4.3 dopuna (2.9.2026, na zahtev vlasnika — kartica Putnici) — dodavanje/izmena/
  // brisanje putnika na već potvrđenoj stavci. Ista dozvola kao ostale izmene rezervacije
  // (booking/MODIFY), nikad ne dira M6 GuestProfile.
  @Post('items/:itemId/guests')
  @RequirePermission('M5', 'booking', 'MODIFY')
  addGuest(@Param('itemId') itemId: string, @Body() dto: CreateBookingItemGuestDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.addGuest(itemId, dto, actor);
  }

  @Patch('items/:itemId/guests/:guestId')
  @RequirePermission('M5', 'booking', 'MODIFY')
  updateGuest(
    @Param('itemId') itemId: string,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateBookingItemGuestDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.bookings.updateGuest(itemId, guestId, dto, actor);
  }

  @Delete('items/:itemId/guests/:guestId')
  @RequirePermission('M5', 'booking', 'MODIFY')
  removeGuest(@Param('itemId') itemId: string, @Param('guestId') guestId: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.removeGuest(itemId, guestId, actor);
  }

  // M5 spec §6.5 (31.8.2026) — prenos vlasništva; ownership provera (trenutni vlasnik ili
  // Vlasnik/Direktor) je u servisu, dozvola ovde samo gate-uje ko sme uopšte da pokuša.
  @Post(':id/transfer-ownership')
  @RequirePermission('M5', 'booking', 'TRANSFER_OWNERSHIP')
  transferOwnership(@Param('id') id: string, @Body() dto: TransferOwnershipDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.transferOwnership(id, dto.newOwnerId, actor);
  }

  // M5 spec §6.5 — predlog predaje zaduženja; Vlasnik/Direktor izvršavaju odmah (servis),
  // ostali kreiraju PENDING predlog koji primalac mora prihvatiti/odbiti ispod.
  @Post(':id/handoff-requests')
  @RequirePermission('M5', 'booking', 'TRANSFER_ASSIGNMENT')
  proposeHandoff(@Param('id') id: string, @Body() dto: ProposeHandoffDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.proposeHandoff(id, dto.toUserId, actor);
  }

  // Dopuna (31.8.2026) — ista dozvola kao pregled same rezervacije (booking/VIEW), nema poseban
  // gate: ko vidi rezervaciju, sme da vidi i njenu istoriju predaje zaduženja.
  @Get(':id/handoff-requests')
  @RequirePermission('M5', 'booking', 'VIEW')
  listHandoffRequests(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.listHandoffRequests(id, actor.userId);
  }

  @Post('handoff-requests/:handoffId/accept')
  @RequirePermission('M5', 'booking', 'ACCEPT_ASSIGNMENT')
  acceptHandoff(@Param('handoffId') handoffId: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.acceptHandoff(handoffId, actor);
  }

  @Post('handoff-requests/:handoffId/decline')
  @RequirePermission('M5', 'booking', 'ACCEPT_ASSIGNMENT')
  declineHandoff(@Param('handoffId') handoffId: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.declineHandoff(handoffId, actor);
  }

  @Post('handoff-requests/:handoffId/cancel')
  @RequirePermission('M5', 'booking', 'TRANSFER_ASSIGNMENT')
  cancelHandoff(@Param('handoffId') handoffId: string, @CurrentUser() actor: { userId: string }) {
    return this.bookings.cancelHandoff(handoffId, actor);
  }

  @Post(':id/voucher/override')
  @RequirePermission('M5', 'voucher', 'OVERRIDE_ISSUE')
  voucherOverride(@Param('id') id: string, @Body() dto: VoucherOverrideDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.voucherOverride(id, dto.reason, actor);
  }

  // M5 spec §8.4 dopuna (v1.15) — "opcija slanja rezervacije pojedinačno dobavljačima": priprema
  // po jedan DRAFT SupplierManifest za svakog dobavljača ove rezervacije, odmah, bez čekanja na
  // periodični posao. Slanje ostaje nepromenjeno (POST /supplier-manifests/:id/send), ovde se
  // samo generišu nacrti — ista dozvola kao POST /supplier-manifests (generisanje nacrta).
  @Post(':id/prepare-supplier-manifests')
  @RequirePermission('M5', 'supplier-manifest', 'CREATE')
  prepareSupplierManifests(
    @Param('id') id: string,
    @Body() dto: PrepareSupplierManifestsDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.supplierManifests.prepareForBooking(id, actor.userId, dto.language);
  }
}
