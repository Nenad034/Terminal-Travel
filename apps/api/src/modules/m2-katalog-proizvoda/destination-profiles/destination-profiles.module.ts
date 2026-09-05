import { Module } from '@nestjs/common';
import { DestinationProfilesService } from './destination-profiles.service';
import { DestinationProfilesController } from './destination-profiles.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [DestinationProfilesController],
  providers: [DestinationProfilesService],
  exports: [DestinationProfilesService],
})
export class DestinationProfilesModule {}
