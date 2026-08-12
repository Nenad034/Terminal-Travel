import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-exchange-rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  @Get()
  @RequirePermission('M10', 'exchange-rate', 'VIEW')
  findAll(@Query('currency') currency: string | undefined) {
    return this.exchangeRates.findAll({ currency });
  }

  @Post()
  @RequirePermission('M10', 'exchange-rate', 'EDIT')
  create(@Body() dto: CreateExchangeRateDto, @CurrentUser() actor: { userId: string }) {
    return this.exchangeRates.create(dto, actor);
  }
}
