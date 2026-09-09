import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricelistService } from './pricelist.service';
import { UpsertSeasonDto } from './dto/upsert-season.dto';
import { WriteCellDto } from './dto/write-cell.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * M3 spec §2.11 / §6 — cenovnik kao mreža, prefiks /api/v1/contracting.
 *
 * Dozvole se namerno NE uvode nove: ko sme da menja periode i cene (`M3/contract-period`)
 * sme i sezone, jer sezona bez cena nema svrhu, a cena bez sezone se ionako unosi istim
 * pravom. Nova dozvola bi tražila dodelu po korisniku za posao koji je isti.
 */
@ApiTags('contracting-pricelist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting')
export class PricelistController {
  constructor(private readonly pricelist: PricelistService) {}

  @Get('contracts/:contractId/seasons')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  listSeasons(@Param('contractId') contractId: string) {
    return this.pricelist.listSeasons(contractId);
  }

  @Post('contracts/:contractId/seasons')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  createSeason(
    @Param('contractId') contractId: string,
    @Body() dto: UpsertSeasonDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.createSeason(contractId, dto, actor.userId);
  }

  @Patch('contracts/:contractId/seasons/:seasonId')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  updateSeason(
    @Param('contractId') contractId: string,
    @Param('seasonId') seasonId: string,
    @Body() dto: UpsertSeasonDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.updateSeason(contractId, seasonId, dto, actor.userId);
  }

  @Delete('contracts/:contractId/seasons/:seasonId')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  deleteSeason(
    @Param('contractId') contractId: string,
    @Param('seasonId') seasonId: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.deleteSeason(contractId, seasonId, actor.userId);
  }

  /** Cela mreža jednog ugovora — sezone kao kolone, tipovi soba kao grupe redova. */
  @Get('contracts/:contractId/pricelist-grid')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  grid(@Param('contractId') contractId: string) {
    return this.pricelist.grid(contractId);
  }

  /** Upis jedne ćelije — ista cena u svaki period te sezone i tog tipa sobe. */
  @Put('contracts/:contractId/pricelist-grid/cell')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  writeCell(
    @Param('contractId') contractId: string,
    @Body() dto: WriteCellDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.writeCell(contractId, dto, actor.userId);
  }
}
