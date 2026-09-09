import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricelistService } from './pricelist.service';
import { UpsertSeasonDto } from './dto/upsert-season.dto';
import { WriteCellDto } from './dto/write-cell.dto';
import { UpsertSurchargeDto } from './dto/upsert-surcharge.dto';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';
import { PricelistCalendarQueryDto } from './dto/pricelist-calendar-query.dto';
import { PricelistCalendarService } from './pricelist-calendar.service';
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
  constructor(
    private readonly pricelist: PricelistService,
    private readonly kalendarService: PricelistCalendarService,
  ) {}

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

  // ── doplate i popusti (§2.11j/§2.11k)

  /** Sve doplate i popusti ugovora, sa razrešenim dometom i oznakom da li ulaze u zbir. */
  @Get('contracts/:contractId/pricelist-surcharges')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  surcharges(@Param('contractId') contractId: string) {
    return this.pricelist.surcharges(contractId);
  }

  @Post('contracts/:contractId/pricelist-surcharges')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  createSurcharge(
    @Param('contractId') contractId: string,
    @Body() dto: UpsertSurchargeDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.createSurcharge(contractId, dto, actor.userId);
  }

  /** Gašenje, ne brisanje (§2.4c) — stavka je finansijski podatak. */
  @Delete('contracts/:contractId/pricelist-surcharges/:id')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  deactivateSurcharge(
    @Param('contractId') contractId: string,
    @Param('id') id: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.deactivateSurcharge(contractId, id, actor.userId);
  }

  // ── marža i provizija po stavci (§2.11i)

  /** Sve stavke ugovora, sa naznakom koja ima sopstveno pravilo. Izuzeci idu prvi. */
  @Get('contracts/:contractId/pricing-rules')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  pricingRules(@Param('contractId') contractId: string) {
    return this.pricelist.pricingRules(contractId);
  }

  @Put('contracts/:contractId/pricing-rules')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertPricingRule(
    @Param('contractId') contractId: string,
    @Body() dto: UpsertPricingRuleDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.upsertPricingRule(contractId, dto, actor.userId);
  }

  /** Uklanjanje izuzetka — stavka se vraća na podrazumevano pravilo ugovora. */
  @Post('contracts/:contractId/pricing-rules/remove')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  removePricingRule(
    @Param('contractId') contractId: string,
    @Body() dto: UpsertPricingRuleDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.pricelist.deletePricingRule(contractId, dto, actor.userId);
  }

  /**
   * §2.11o — kalendar cena i raspoloživosti. **Pregled, ne unos.**
   *
   * Dozvola je `contract-period/VIEW`, ista kao za ostatak cenovnika: kalendar ne otkriva ni
   * jedan podatak koji se već ne vidi na mreži cena i na ekranu kapaciteta — samo ih spaja u
   * jedan pogled. Dodatna dozvola bi tražila dodelu po korisniku za posao koji je isti.
   */
  @Get('contracts/:contractId/pricelist-calendar')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  kalendar(@Param('contractId') contractId: string, @Query() q: PricelistCalendarQueryDto) {
    return this.kalendarService.kalendar(contractId, q);
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
