import { BadRequestException, Controller, ForbiddenException, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { AccessTokenPayload } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

// M5 spec §11 dopuna (avgust 2026, priprema za M8) — pretraga je JAVNA, bez guard-a.
// M8 spec poglavlje 3 korak 1 zahteva anonimnu pretragu (gost bez naloga); ranija verzija
// ovog kontrolera zahtevala je JwtAuthGuard, što je bilo neusklađeno sa tim zahtevom —
// isti princip kao M2 PublicProductsController (poglavlje 5.1: identitet dobavljača se
// ionako nikad ne izlaže ka B2C/B2B, nema osetljivog podatka koji bi guard štitio ovde).
@ApiTags('sales-search')
@Controller('sales/search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async find(@Query() query: SearchQueryDto, @Req() req: Request) {
    // `channel=INTERNAL_PANEL` preskače visible_channels filter (search.service.ts) —
    // ostatak kontrolera ostaje bez guard-a (anonimna M8 pretraga), pa se OVDE, samo za
    // ovu vrednost, ručno proverava prijavljen interni tim + M5/booking/VIEW (otkriveno
    // pri implementaciji M17 — do sada niko nije pozvao pretragu ovim kanalom).
    if (query.channel === 'INTERNAL_PANEL') {
      const authHeader = req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedException('channel=INTERNAL_PANEL zahteva prijavu (Bearer token).');
      }
      let payload: AccessTokenPayload;
      try {
        payload = this.jwt.verify<AccessTokenPayload>(authHeader.slice('Bearer '.length));
      } catch {
        throw new UnauthorizedException('Nevažeći ili istekao token.');
      }
      const allowed = await this.permissions.hasPermission(payload.sub, 'M5', 'booking', 'VIEW');
      if (!allowed) {
        throw new ForbiddenException('Nedostaje dozvola M5/booking/VIEW za channel=INTERNAL_PANEL.');
      }
    }

    let occupancy;
    if (query.occupancy) {
      try {
        occupancy = JSON.parse(query.occupancy);
      } catch {
        throw new BadRequestException('occupancy mora biti validan JSON (M5 spec §11)');
      }
    }
    return this.search.search({
      type: query.type,
      destinationCountry: query.destinationCountry,
      destinationCity: query.destinationCity,
      stayFrom: query.stayFrom,
      stayTo: query.stayTo,
      occupancy,
      channel: query.channel,
      lang: query.lang,
      cabinClass: query.cabinClass,
      originCity: query.originCity,
      minDriverAge: query.minDriverAge,
      durationNights: query.durationNights,
      cabinType: query.cabinType,
      amenityTags: query.amenityTags,
    });
  }
}
