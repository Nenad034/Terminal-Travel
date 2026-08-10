import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditLogModule } from './audit-log/audit-log.module';

// docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md
@Module({
  imports: [AuthModule, UsersModule, RolesModule, PermissionsModule, AuditLogModule],
})
export class M1CoreIdentitetModule {}
