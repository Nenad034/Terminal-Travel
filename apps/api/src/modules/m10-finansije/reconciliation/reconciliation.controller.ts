import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get('mismatches')
  @RequirePermission('M10', 'fiscal-document', 'VIEW')
  findMismatches() {
    return this.reconciliation.findMismatches();
  }
}
