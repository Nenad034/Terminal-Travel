import { Module } from '@nestjs/common';
import { SupplierManifestsService } from './supplier-manifests.service';
import { SupplierManifestsController } from './supplier-manifests.controller';
import { SupplierChangeNoticesService } from './supplier-change-notices.service';
import { SupplierChangeNoticesController } from './supplier-change-notices.controller';
import { M22MailboxStubService } from '../common/m22-mailbox-stub.service';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [SupplierManifestsController, SupplierChangeNoticesController],
  providers: [SupplierManifestsService, SupplierChangeNoticesService, M22MailboxStubService],
  exports: [SupplierManifestsService, SupplierChangeNoticesService],
})
export class SupplierManifestsModule {}
