import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ContractPeriodsService } from '../contract-periods/contract-periods.service';

// M3 spec §6, prefiks /api/v1/contracting
@ApiTags('contracting-contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting/contracts')
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly periods: ContractPeriodsService,
  ) {}

  @Get()
  @RequirePermission('M3', 'contract', 'VIEW')
  findAll() {
    return this.contracts.findAll();
  }

  @Post()
  @RequirePermission('M3', 'contract', 'CREATE')
  create(@Body() dto: CreateContractDto, @CurrentUser() actor: { userId: string }) {
    return this.contracts.create(dto, actor.userId);
  }

  // Mora biti registrovano PRE @Get(':id') — inače Nest/Express interpretira
  // "expiring-releases" kao vrednost :id parametra (isti oblik rute, redosled odlučuje).
  @Get('expiring-releases')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  expiringReleases() {
    return this.periods.expiringReleases();
  }

  @Get(':id')
  @RequirePermission('M3', 'contract', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('M3', 'contract', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto, @CurrentUser() actor: { userId: string }) {
    return this.contracts.update(id, dto, actor.userId);
  }
}
