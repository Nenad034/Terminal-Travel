import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractPeriodsService } from './contract-periods.service';
import { CreateContractPeriodDto } from './dto/create-contract-period.dto';
import { UpsertRateLineDto } from './dto/upsert-rate-line.dto';
import { UpsertCancellationRuleDto } from './dto/upsert-cancellation-rule.dto';
import { UpsertOfferDto } from './dto/upsert-offer.dto';
import { UpsertAncillaryServiceDto } from './dto/upsert-ancillary-service.dto';
import { UpsertTouristTaxDto } from './dto/upsert-tourist-tax.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M3 spec §6, prefiks /api/v1/contracting
@ApiTags('contracting-periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting')
export class ContractPeriodsController {
  constructor(private readonly periods: ContractPeriodsService) {}

  @Get('contracts/:contractId/periods')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  findAll(@Param('contractId') contractId: string) {
    return this.periods.findAll(contractId);
  }

  @Post('contracts/:contractId/periods')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  create(
    @Param('contractId') contractId: string,
    @Body() dto: CreateContractPeriodDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.create(contractId, dto, actor.userId);
  }

  @Get('contracts/:contractId/periods/:periodId')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  findOne(@Param('periodId') periodId: string) {
    return this.periods.findOne(periodId);
  }

  @Get('contracts/:contractId/periods/:periodId/rates')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  listRates(@Param('periodId') periodId: string) {
    return this.periods.listRateLines(periodId);
  }

  @Put('contracts/:contractId/periods/:periodId/rates')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertRate(
    @Param('periodId') periodId: string,
    @Body() dto: UpsertRateLineDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.upsertRateLine(periodId, dto, actor.userId);
  }

  @Get('contracts/:contractId/periods/:periodId/cancellation-rules')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  listCancellationRules(@Param('periodId') periodId: string) {
    return this.periods.listCancellationRules(periodId);
  }

  @Put('contracts/:contractId/periods/:periodId/cancellation-rules')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertCancellationRule(
    @Param('periodId') periodId: string,
    @Body() dto: UpsertCancellationRuleDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.upsertCancellationRule(periodId, dto, actor.userId);
  }

  // M3 spec §2.4b/§6 — dopuna v1.12
  @Get('contracts/:contractId/periods/:periodId/offers')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  listOffers(@Param('periodId') periodId: string) {
    return this.periods.listOffers(periodId);
  }

  @Put('contracts/:contractId/periods/:periodId/offers')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertOffer(
    @Param('periodId') periodId: string,
    @Body() dto: UpsertOfferDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.upsertOffer(periodId, dto, actor.userId);
  }

  // M3 spec §2.6/§6 — dopuna v1.12
  @Get('contracts/:contractId/periods/:periodId/ancillary-services')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  listAncillaryServices(@Param('periodId') periodId: string) {
    return this.periods.listAncillaryServices(periodId);
  }

  @Put('contracts/:contractId/periods/:periodId/ancillary-services')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertAncillaryService(
    @Param('periodId') periodId: string,
    @Body() dto: UpsertAncillaryServiceDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.upsertAncillaryService(periodId, dto, actor.userId);
  }

  // M3 spec §2.7/§6 — dopuna v1.12, isključivo informativno
  @Get('contracts/:contractId/periods/:periodId/tourist-tax')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  getTouristTax(@Param('periodId') periodId: string) {
    return this.periods.getTouristTax(periodId);
  }

  @Put('contracts/:contractId/periods/:periodId/tourist-tax')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  upsertTouristTax(
    @Param('periodId') periodId: string,
    @Body() dto: UpsertTouristTaxDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.upsertTouristTax(periodId, dto, actor.userId);
  }

  @Get('contracts/:contractId/periods/:periodId/availability')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  availability(@Param('periodId') periodId: string) {
    return this.periods.availability(periodId);
  }

  // §6 — "interni poziv (samo M5)". M5 još ne postoji; endpoint sme da ga pozove svako
  // sa M3/contract-period/EDIT dok M5 ne dođe na red i formalizuje sopstveni pristup.
  @Post('contracts/:contractId/periods/:periodId/reserve')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  reserve(
    @Param('periodId') periodId: string,
    @Body('units') units: number,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.periods.reserve(periodId, units ?? 1, actor.userId);
  }
}
