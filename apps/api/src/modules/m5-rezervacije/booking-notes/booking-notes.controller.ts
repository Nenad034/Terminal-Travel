import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingNotesService } from './booking-notes.service';
import { CreateBookingNoteDto } from './dto/create-booking-note.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §4.6/§11, prefiks /api/v1/sales
@ApiTags('sales-booking-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/bookings')
export class BookingNotesController {
  constructor(private readonly notes: BookingNotesService) {}

  // Nema zasebne VIEW dozvole — beleška se vidi sa rezervacijom (M5 spec §11).
  @Get(':id/notes')
  @RequirePermission('M5', 'booking', 'VIEW')
  findForBooking(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.notes.findForBooking(id, actor);
  }

  @Post(':id/notes')
  @RequirePermission('M5', 'booking-note', 'CREATE')
  create(@Param('id') id: string, @Body() dto: CreateBookingNoteDto, @CurrentUser() actor: { userId: string }) {
    return this.notes.create(id, dto.body, actor);
  }

  @Delete(':id/notes/:noteId')
  @RequirePermission('M5', 'booking-note', 'DELETE')
  remove(@Param('id') id: string, @Param('noteId') noteId: string, @CurrentUser() actor: { userId: string }) {
    return this.notes.remove(id, noteId, actor);
  }
}
