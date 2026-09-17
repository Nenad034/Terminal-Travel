import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { TextIntakeExtractDto, TextIntakeSitePreviewDto } from './dto/text-intake.dto';
import { TextIntakeService } from './text-intake.service';
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
    private readonly textIntake: TextIntakeService,
  ) {}

  // M5 spec §3.0j.4 — ponuda iz nalepljenog teksta: model čita, kod upari, čovek klikne.
  // Ista dozvola kao kreiranje ponude; ništa se ne upisuje dok čovek ne pozove POST /quotes.
  @Post('text-intake/extract')
  @RequirePermission('M5', 'quote', 'CREATE')
  textIntakeExtract(@Body() dto: TextIntakeExtractDto) {
    return this.textIntake.extract(dto.text, dto.answers ?? []);
  }

  /** §3.0j.7 t. 3 — predlog opisa/kategorije sa zvaničnog sajta (čovek odobrava na ekranu). */
  @Post('text-intake/site-preview')
  @RequirePermission('M5', 'quote', 'CREATE')
  textIntakeSitePreview(@Body() dto: TextIntakeSitePreviewDto) {
    return this.textIntake.sitePreview(dto.url);
  }

  @Post()
  @RequirePermission('M5', 'quote', 'CREATE')
  create(@Body() dto: CreateQuoteDto, @CurrentUser() actor: { userId: string }) {
    return this.quotes.create(dto, actor);
  }

  @Get(':id')
  @RequirePermission('M5', 'quote', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.quotes.findOne(id, actor.userId);
  }

  // M5 spec §4/§11 — POST /quotes/:id/confirm: pokreće tok Ponuda → Rezervacija.
  @Post(':id/confirm')
  @RequirePermission('M5', 'booking', 'CREATE')
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmQuoteDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.bookings.confirmQuote(id, dto, actor);
  }
}
