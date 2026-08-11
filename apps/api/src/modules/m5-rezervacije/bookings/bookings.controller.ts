import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ModifyBookingDto } from './dto/modify-booking.dto';
import { UpdatePaymentStatusDto } from './dto/payment-status.dto';
import { VoucherOverrideDto } from './dto/voucher-override.dto';
import { PrepareSupplierManifestsDto } from './dto/prepare-supplier-manifests.dto';
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

  @Get()
  @RequirePermission('M5', 'booking', 'VIEW')
  findAll(
    @Query('status') status: string | undefined,
    @Query('channel') channel: string | undefined,
    @Query('clientAccountId') clientAccountId: string | undefined,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.bookings.findAll({ status, channel, clientAccountId }, actor);
  }

  @Get('calendar-summary')
  @RequirePermission('M5', 'booking', 'VIEW')
  calendarSummary(@Query('from') from: string, @Query('to') to: string) {
    return this.bookings.calendarSummary(new Date(from), new Date(to));
  }

  @Get('calendar/:date')
  @RequirePermission('M5', 'booking', 'VIEW')
  calendarDay(@Param('date') date: string) {
    return this.bookings.calendarDay(new Date(date));
  }

  @Get(':id')
  @RequirePermission('M5', 'booking', 'VIEW')
  findOne(@Param('id') id: string) {
    // Interni panel je jedini pozivalac ovog kontrolera (M17) — M8/M9/M7 dobijaju svoje
    // maskirane odgovore preko sopstvenih (budućih) kanala; §6.2 sprovodi se ovde eksplicitno
    // preko konteksta INTERNAL_PANEL, ne implicitno.
    return this.bookings.findOne(id, 'INTERNAL_PANEL');
  }

  @Post(':id/modify')
  @RequirePermission('M5', 'booking', 'MODIFY')
  modify(@Param('id') id: string, @Body() dto: ModifyBookingDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.modify(id, dto, actor);
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
