import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FieldStaffService } from './field-staff.service';
import { SyncFieldDataDto } from './dto/sync-field-data.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M9 spec §7, prefiks /api/v1/mobile — deo za vodiče na terenu (offline-first). Deo za goste
// (§2) koristi identične endpoint-e kao M8 (bez sopstvenih M9 ruta), nije ovde.
@ApiTags('mobile-field-staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mobile/staff')
export class FieldStaffController {
  constructor(private readonly fieldStaff: FieldStaffService) {}

  @Get('my-itinerary')
  @RequirePermission('M9', 'field-itinerary', 'VIEW')
  myItinerary(@Query('from') from: string, @Query('to') to: string, @CurrentUser() actor: { userId: string }) {
    return this.fieldStaff.myItinerary(actor.userId, new Date(from), new Date(to));
  }

  // §3.2 dopuna (1.9.2026) — kancelarijski pregled prijava sa terena za jednu rezervaciju
  // (kartica "Predstavnici", M5 spec §4.5). Zasebna VIEW dozvola: vodič na terenu ima CREATE,
  // ali ne mora imati uvid u ceo tok kancelarije, i obrnuto.
  @Get('check-ins')
  @RequirePermission('M9', 'field-checkin', 'VIEW')
  checkIns(@Query('bookingId') bookingId: string) {
    return this.fieldStaff.checkInsForBooking(bookingId);
  }

  // Gejtovano na field-checkin/CREATE (uvek dodeljena uz field-incident/CREATE za VODIC, §6) —
  // granularna provera za incidentNotes se radi u servisu (PermissionsService direktno), jer
  // jedan zahtev može nositi oba tipa zapisa istovremeno (§3.2 "šalje ceo red čekanja odjednom").
  @Post('sync')
  @RequirePermission('M9', 'field-checkin', 'CREATE')
  sync(@Body() dto: SyncFieldDataDto, @CurrentUser() actor: { userId: string }) {
    return this.fieldStaff.sync(actor.userId, dto);
  }
}
