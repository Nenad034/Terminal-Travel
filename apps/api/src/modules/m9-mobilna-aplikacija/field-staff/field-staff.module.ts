import { Module } from '@nestjs/common';
import { FieldStaffService } from './field-staff.service';
import { FieldStaffController } from './field-staff.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, EventBusModule],
  controllers: [FieldStaffController],
  providers: [FieldStaffService],
  exports: [FieldStaffService],
})
export class FieldStaffModule {}
