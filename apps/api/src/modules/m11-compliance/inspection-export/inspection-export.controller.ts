import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InspectionExportService } from './inspection-export.service';
import { GenerateInspectionExportDto } from './dto/generate-inspection-export.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M11 spec §5, prefiks /api/v1/compliance
@ApiTags('compliance-inspection-export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compliance/inspection-export')
export class InspectionExportController {
  constructor(private readonly inspectionExport: InspectionExportService) {}

  @Post()
  @RequirePermission('M11', 'inspection-export', 'CREATE')
  generate(@Body() dto: GenerateInspectionExportDto) {
    return this.inspectionExport.generate(dto);
  }
}
