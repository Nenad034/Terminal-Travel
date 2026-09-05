import { BadRequestException, Controller, ForbiddenException, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { AccessTokenPayload, assertAccessTokenPayload } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

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

  /**
   * `channel=INTERNAL_PANEL` preskače `visible_channels` filter, pa taj kanal — i samo on —
   * traži prijavu i `M5/booking/VIEW`. Ostatak kontrolera ostaje javan (anonimna M8 pretraga).
   * Izdvojeno u metodu 2.9.2026 kad su dodati endpointi za predlaganje: bez toga bi svaki nov
   * endpoint morao da ponovi istu proveru, a zaboravljena provera je tiha rupa.
   */
  private async assertInternalPanelAccess(channel: string | undefined, req: Request): Promise<void> {
    if (channel !== 'INTERNAL_PANEL') return;
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('channel=INTERNAL_PANEL zahteva prijavu (Bearer token).');
    }
    let payload: AccessTokenPayload;
    try {
      payload = assertAccessTokenPayload(this.jwt.verify<AccessTokenPayload>(authHeader.slice('Bearer '.length)));
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao token.');
    }
    const allowed = await this.permissions.hasPermission(payload.sub, 'M5', 'booking', 'VIEW');
    if (!allowed) {
      throw new ForbiddenException('Nedostaje dozvola M5/booking/VIEW za channel=INTERNAL_PANEL.');
    }
  }

  /** M5 spec §3.0c.2, korak 1 — predlaganje država dok se kuca. */
  @Get('countries')
  async countries(@Query('q') q: string | undefined, @Query('channel') channel: string, @Req() req: Request) {
    await this.assertInternalPanelAccess(channel, req);
    return this.search.suggestCountries(q, (channel ?? 'B2C_SITE') as never);
  }

  /**
   * M5 spec §3.0c.2, korak 2 — destinacije izabrane države; bez `q` vraća sve (vlasnikov
   * zahtev: čim se izabere država, mesta se odmah nude), sa `q` sužava i traži i po nazivu
   * objekta.
   */
  @Get('destinations')
  async destinations(
    @Query('country') country: string,
    @Query('q') q: string | undefined,
    @Query('channel') channel: string,
    @Query('lang') lang: string | undefined,
    @Req() req: Request,
  ) {
    if (!country) throw new BadRequestException('Parametar `country` je obavezan (M5 spec §3.0c.2).');
    await this.assertInternalPanelAccess(channel, req);
    return this.search.suggestDestinations(country, q, (channel ?? 'B2C_SITE') as never, lang);
  }

  /**
   * M5 spec §3.0c.3e (dopuna 5.9.2026) — pretraga po aktivnosti, alternativan ulaz u pretragu.
   * Isti pristup/vidljivost kao `GET /sales/search/destinations` (§3.0c.2) — `channel=INTERNAL_PANEL`
   * traži prijavu + `M5/booking/VIEW`, ostatak je javan (anonimna M8 pretraga).
   */
  @Get('destinations-by-activity')
  async destinationsByActivity(
    @Query('activity') activity: string,
    @Query('channel') channel: string,
    @Req() req: Request,
  ) {
    if (!activity) throw new BadRequestException('Parametar `activity` je obavezan (M5 spec §3.0c.3e).');
    await this.assertInternalPanelAccess(channel, req);
    return this.search.suggestDestinationsByActivity(activity, (channel ?? 'B2C_SITE') as never);
  }

  @Get()
  async find(@Query() query: SearchQueryDto, @Req() req: Request) {
    await this.assertInternalPanelAccess(query.channel, req);

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
      bbox: query.bbox,
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
      hasExpertGuide: query.hasExpertGuide,
    });
  }
}
