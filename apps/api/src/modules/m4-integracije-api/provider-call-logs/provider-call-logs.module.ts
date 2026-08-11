import { Module } from '@nestjs/common';
import { ProviderCallLogsService } from './provider-call-logs.service';
import { ProviderCallLogsController } from './provider-call-logs.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [ProviderCallLogsController],
  providers: [ProviderCallLogsService],
  exports: [ProviderCallLogsService],
})
export class ProviderCallLogsModule {}
