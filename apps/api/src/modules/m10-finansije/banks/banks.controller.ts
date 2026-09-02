import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BanksService } from './banks.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M10 spec §5.2 dopuna (2.9.2026), prefiks /api/v1/finance
@ApiTags('finance-banks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/banks')
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  // Ista dozvola kao uvid u uplate — spisak banaka je isključivo pomoćni podatak za formu
  // unosa uplate, nema smisla kao posebna dozvola.
  @Get()
  @RequirePermission('M10', 'payment', 'VIEW')
  findAll() {
    return this.banks.findAll();
  }
}
