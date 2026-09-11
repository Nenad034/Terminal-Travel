import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ContractPeriodsService } from '../contract-periods/contract-periods.service';
import { parsePagination } from '../../../common/pagination/pagination';
import { toProductTypes } from '../product-scope';

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
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    // 8.9.2026 — filteri na serveru (spec §6): lista je straničena, pa bi klijentsko
    // filtriranje pretraživalo samo trenutnu stranu i tiho krilo ostalo.
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    // v1.24 — filteri kroz proizvode (destinacija, objekat, vrsta). Vidi `product-scope.ts`.
    @Query('destinationCountry') destinationCountry?: string,
    @Query('destinationCity') destinationCity?: string,
    @Query('productName') productName?: string,
    @Query('productType') productType?: string | string[],
  ) {
    return this.contracts.findAll(parsePagination(page, limit), {
      q,
      status: status ? (status as ContractStatus) : undefined,
      supplierId,
      destinationCountry,
      destinationCity,
      productName,
      productType: toProductTypes(productType),
    });
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

  /**
   * §2.11m — tipovi soba iz kataloga koje ovaj ugovor pokriva; ekran za unos perioda bira iz
   * ovog spiska umesto da se šifra kuca ručno. Dozvola je ista kao za period — ko sme da unese
   * period sme i da vidi iz kojih soba bira.
   */
  @Get(':id/room-types')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  roomTypes(@Param('id') id: string) {
    return this.contracts.roomTypes(id);
  }

  @Get(':id')
  @RequirePermission('M3', 'contract', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('M3', 'contract', 'EDIT')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.contracts.update(id, dto, actor.userId);
  }
}
