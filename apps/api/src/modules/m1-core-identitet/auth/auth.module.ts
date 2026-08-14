import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSharedModule } from '../../../common/auth-shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  // PermissionsModule — M17 integracija (avgust 2026): GET /iam/auth/me koristi
  // PermissionsService.effectivePermissions da vrati sopstvena prava korisnika.
  imports: [AuthSharedModule, AuditLogModule, EventBusModule, PermissionsModule],
  controllers: [AuthController],
  providers: [AuthService],
  // AuthSharedModule se re-eksportuje da moduli koji importuju AuthModule (za AuthService)
  // dobiju i JwtAuthGuard bez dodatnog importa — sprečava tačno ovakvu grešku.
  exports: [AuthService, AuthSharedModule],
})
export class AuthModule {}
