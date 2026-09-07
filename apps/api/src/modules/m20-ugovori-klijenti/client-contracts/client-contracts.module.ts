import { Module } from '@nestjs/common';
import { ClientContractsService } from './client-contracts.service';
import { ClientContractsController } from './client-contracts.controller';
import { AgencyStaticConfigService } from './agency-static-config';
import { AgencySettingsModule } from '../../m1-core-identitet/agency-settings/agency-settings.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { MockContractDocumentGeneratorAdapter } from '../adapters/mock-contract-document-generator.adapter';
import { CONTRACT_DOCUMENT_GENERATOR_ADAPTER } from '../adapters/contract-document-generator.token';

@Module({
  imports: [
    AgencySettingsModule, // M1 §3.9c — naziv/adresa/licenca agencije dolaze odatle, ne iz env-a
    AuditLogModule,
    AuthModule,
    PermissionsModule,
  ],
  controllers: [ClientContractsController],
  providers: [
    ClientContractsService,
    AgencyStaticConfigService,
    MockContractDocumentGeneratorAdapter,
    {
      provide: CONTRACT_DOCUMENT_GENERATOR_ADAPTER,
      useExisting: MockContractDocumentGeneratorAdapter,
    },
  ],
  exports: [ClientContractsService],
})
export class ClientContractsModule {}
