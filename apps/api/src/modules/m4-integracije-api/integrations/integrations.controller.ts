import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from '../integrations.service';
import { SearchProviderDto } from './dto/search-provider.dto';
import { AvailabilityProviderDto } from './dto/availability-provider.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

/**
 * M4 spec §7 — "Interni (poziva ih isključivo M2/M5, nisu izloženi kanalima poput sajta
 * ili B2B portala)". Namerno bez @RequirePermission — M4 spec §6 dodeljuje dozvole samo
 * za administrativni uvid/podešavanje provajdera (provider-config/provider-call-log),
 * ne za ove operativne pozive; JwtAuthGuard je dovoljna granica prema spec tekstu.
 */
@ApiTags('integrations-internal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/internal/providers')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post(':code/search')
  search(@Param('code') code: string, @Body() dto: SearchProviderDto) {
    return this.integrations.search(code, dto);
  }

  @Get(':code/content/:externalId')
  getContent(@Param('code') code: string, @Param('externalId') externalId: string) {
    return this.integrations.getStaticContent(code, externalId);
  }

  @Post(':code/availability')
  availability(@Param('code') code: string, @Body() dto: AvailabilityProviderDto) {
    return this.integrations.checkAvailabilityAndPrice(code, dto.externalId, {
      stayFrom: dto.stayFrom,
      stayTo: dto.stayTo,
      adults: dto.adults,
      children: dto.children,
    });
  }

  @Post(':code/bookings')
  confirmBooking(@Param('code') code: string, @Body() dto: ConfirmBookingDto) {
    return this.integrations.confirmBooking(code, dto.externalId, {
      stay: { stayFrom: dto.stayFrom, stayTo: dto.stayTo, adults: dto.adults, children: dto.children },
      guestName: dto.guestName,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Post(':code/bookings/:ref/cancel')
  cancelBooking(@Param('code') code: string, @Param('ref') ref: string) {
    return this.integrations.cancelBooking(code, ref);
  }
}
