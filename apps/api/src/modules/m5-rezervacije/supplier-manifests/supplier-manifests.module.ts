import { Module } from '@nestjs/common';
import { SupplierManifestsService } from './supplier-manifests.service';
import { SupplierManifestsController } from './supplier-manifests.controller';
import { SupplierChangeNoticesService } from './supplier-change-notices.service';
import { SupplierChangeNoticesController } from './supplier-change-notices.controller';
import { SupplierMailboxService } from '../common/supplier-mailbox.service';
import { M22EmailInboxModule } from '../../m22-email-inbox/m22-email-inbox.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  // M5 §8.8 (5.9.2026) — najava dobavljaču ide kroz jedinstveno M22 sanduče, pa je M22 modul
  // stvarna zavisnost (in-process DI, isti hibridni obrazac kao M22→M14 konverzija u tiket).
  // Do danas je ovde stajao stub koji nije slao ništa (dok. 39 nalaz 1.2).
  imports: [AuditLogModule, AuthModule, PermissionsModule, M22EmailInboxModule],
  controllers: [SupplierManifestsController, SupplierChangeNoticesController],
  providers: [SupplierManifestsService, SupplierChangeNoticesService, SupplierMailboxService],
  exports: [SupplierManifestsService, SupplierChangeNoticesService],
})
export class SupplierManifestsModule {}
