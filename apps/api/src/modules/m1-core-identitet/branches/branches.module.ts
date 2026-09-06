import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

// `JwtAuthGuard`/`PermissionsGuard` na kontroleru zahtevaju `JwtService`/`PermissionsService` iz
// ova dva modula — bez njih Nest ne ume da razreši zavisnosti gard-ova (isti obrazac kao
// `RolesModule`).
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
