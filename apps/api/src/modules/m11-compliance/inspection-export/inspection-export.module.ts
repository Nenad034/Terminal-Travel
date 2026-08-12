import { Module } from '@nestjs/common';
import { InspectionExportService } from './inspection-export.service';
import { InspectionExportController } from './inspection-export.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [InspectionExportController],
  providers: [InspectionExportService],
})
export class InspectionExportModule {}
