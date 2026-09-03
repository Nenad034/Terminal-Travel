import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from '../integrations.service';
import { SearchProviderDto } from './dto/search-provider.dto';
import { AvailabilityProviderDto } from './dto/availability-provider.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

/**
 * M4 spec §7 — "Interni (poziva ih isključivo M2/M5, nisu izloženi kanalima poput sajta
 * ili B2B portala)", uz dozvolu `M4/provider-config/EDIT` (spec §6, dopuna 3.9.2026).
 *
 * Ranije je ovde stajao samo `JwtAuthGuard`, uz obrazloženje da je "spec tekst dovoljna
 * granica". Nije bio: spec kaže ko TREBA da zove, ne ko MOŽE. Pošto je `POST /iam/auth/register`
 * javan i pravi nalog odmah u statusu ACTIVE, svaki samoregistrovan gost je mogao da pozove
 * `search` (neto cene bez marže), `bookings` (stvarna rezervacija kod spoljnog dobavljača) i
 * `cancel`. Vidi zamku 13.3 u docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md.
 *
 * Zatvaranje ne dira tok prodaje: M5 ne prolazi kroz HTTP nego koristi `IntegrationsService`
 * direktno (SearchService, QuoteItemBuilderService, BookingsService) — ovi endpoint-i nemaju
 * nijednog HTTP pozivaoca u repozitorijumu, pa su administrativni/dijagnostički ulaz.
 *
 * NAPOMENA: `@RequirePermission` stoji na SVAKOJ metodi, ne jednom na klasi. `PermissionsGuard`
 * čita metapodatak isključivo sa `context.getHandler()` — dekorator na klasi bi bio TIHO
 * ignorisan (guard bi vratio `true` jer "ruta nema @RequirePermission"), pa bi ograda izgledala
 * postavljeno a ne bi postojala. Vidi zamku 13.5.
 */
@ApiTags('integrations-internal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations/internal/providers')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post(':code/search')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  search(@Param('code') code: string, @Body() dto: SearchProviderDto) {
    return this.integrations.search(code, dto);
  }

  @Get(':code/content/:externalId')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  getContent(@Param('code') code: string, @Param('externalId') externalId: string) {
    return this.integrations.getStaticContent(code, externalId);
  }

  @Post(':code/availability')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  availability(@Param('code') code: string, @Body() dto: AvailabilityProviderDto) {
    return this.integrations.checkAvailabilityAndPrice(code, dto.externalId, {
      stayFrom: dto.stayFrom,
      stayTo: dto.stayTo,
      adults: dto.adults,
      children: dto.children,
    });
  }

  @Post(':code/bookings')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  confirmBooking(@Param('code') code: string, @Body() dto: ConfirmBookingDto) {
    return this.integrations.confirmBooking(code, dto.externalId, {
      stay: { stayFrom: dto.stayFrom, stayTo: dto.stayTo, adults: dto.adults, children: dto.children },
      guestName: dto.guestName,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post(':code/bookings/:ref/cancel')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  cancelBooking(@Param('code') code: string, @Param('ref') ref: string) {
    return this.integrations.cancelBooking(code, ref);
  }
}
