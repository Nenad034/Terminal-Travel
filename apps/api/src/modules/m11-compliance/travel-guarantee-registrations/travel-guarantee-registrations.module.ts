import { Module } from '@nestjs/common';
import { TravelGuaranteeRegistrationsService } from './travel-guarantee-registrations.service';
import { TravelGuaranteeRegistrationsController } from './travel-guarantee-registrations.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { MockCisGatewayAdapter } from '../adapters/mock-cis-gateway.adapter';
import { CIS_GATEWAY_ADAPTER } from '../adapters/cis-gateway.token';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [TravelGuaranteeRegistrationsController],
  providers: [
    TravelGuaranteeRegistrationsService,
    MockCisGatewayAdapter,
    { provide: CIS_GATEWAY_ADAPTER, useExisting: MockCisGatewayAdapter },
  ],
  exports: [TravelGuaranteeRegistrationsService],
})
export class TravelGuaranteeRegistrationsModule {}
