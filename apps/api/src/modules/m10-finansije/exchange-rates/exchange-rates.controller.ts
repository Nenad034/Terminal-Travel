import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { parsePagination } from '../../../common/pagination/pagination';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-exchange-rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  @Get()
  @RequirePermission('M10', 'exchange-rate', 'VIEW')
  // Straničenje (6.9.2026, dok. 39 nalaz 2.2) — odgovor je `{ data, total, ... }`, ne go niz.
  // `page`/`limit` su pojedinačni parametri, ne DTO (v. common/pagination/pagination.ts).
  findAll(
    @Query('currency') currency: string | undefined,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exchangeRates.findAll({ currency }, parsePagination(page, limit));
  }

  @Post()
  @RequirePermission('M10', 'exchange-rate', 'EDIT')
  create(@Body() dto: CreateExchangeRateDto, @CurrentUser() actor: { userId: string }) {
    return this.exchangeRates.create(dto, actor);
  }
}
