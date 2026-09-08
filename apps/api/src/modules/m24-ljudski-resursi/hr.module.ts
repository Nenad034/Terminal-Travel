import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';

// `JwtAuthGuard`/`PermissionsGuard` na kontroleru zahtevaju `JwtService`/`PermissionsService` iz
// ova dva modula — isti obrazac kao `BranchesModule`.
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
