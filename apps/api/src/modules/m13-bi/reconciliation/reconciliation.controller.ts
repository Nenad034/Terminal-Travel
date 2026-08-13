import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M13 spec §7, prefiks /api/v1/bi — "ručno pokretanje rekonsilijacije (van noćnog rasporeda) —
// Vlasnik/Direktor". Nema poseban ključ dozvole u spec §6 tabeli (samo šest report:* dozvola) —
// gejtuje se sa report:profitability/VIEW, jedina dozvola sa istim tačnim krugom (Vlasnik/Direktor).
@ApiTags('bi-reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bi/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('run')
  @RequirePermission('M13', 'report:profitability', 'VIEW')
  run() {
    return this.reconciliation.reconcile();
  }
}
