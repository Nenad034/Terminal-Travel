import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ConfirmQuoteDto } from '../bookings/dto/confirm-quote.dto';
import { BookingsService } from '../bookings/bookings.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §11, prefiks /api/v1/sales
@ApiTags('sales-quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly bookings: BookingsService,
  ) {}

  @Post()
  @RequirePermission('M5', 'quote', 'CREATE')
  create(@Body() dto: CreateQuoteDto, @CurrentUser() actor: { userId: string }) {
    return this.quotes.create(dto, actor);
  }

  @Get(':id')
  @RequirePermission('M5', 'quote', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.quotes.findOne(id);
  }

  // M5 spec §4/§11 — POST /quotes/:id/confirm: pokreće tok Ponuda → Rezervacija.
  @Post(':id/confirm')
  @RequirePermission('M5', 'booking', 'CREATE')
  confirm(@Param('id') id: string, @Body() dto: ConfirmQuoteDto, @CurrentUser() actor: { userId: string }) {
    return this.bookings.confirmQuote(id, dto, actor);
  }
}
