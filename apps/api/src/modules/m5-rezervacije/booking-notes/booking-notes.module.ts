import { Module } from '@nestjs/common';
import { BookingNotesService } from './booking-notes.service';
import { BookingNotesController } from './booking-notes.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

// M5 spec §4.6 — interne beleške uz rezervaciju.
@Module({
  imports: [BookingsModule, AuditLogModule, AuthModule, PermissionsModule],
  controllers: [BookingNotesController],
  providers: [BookingNotesService],
  exports: [BookingNotesService],
})
export class BookingNotesModule {}
