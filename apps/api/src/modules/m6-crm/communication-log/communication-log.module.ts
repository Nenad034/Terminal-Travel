import { Module } from '@nestjs/common';
import { CommunicationLogService } from './communication-log.service';
import { CommunicationLogController } from './communication-log.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [CommunicationLogController],
  providers: [CommunicationLogService],
  exports: [CommunicationLogService],
})
export class CommunicationLogModule {}
