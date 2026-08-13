import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentPublishSchedulerService } from './content-publish-scheduler.service';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { DistributionModule } from '../distribution/distribution.module';

@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, DistributionModule],
  controllers: [ContentController],
  providers: [ContentService, ContentPublishSchedulerService],
  exports: [ContentService],
})
export class ContentModule {}
