import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

// M5 spec §11 dopuna (avgust 2026, priprema za M8) — pretraga je JAVNA, bez guard-a.
// M8 spec poglavlje 3 korak 1 zahteva anonimnu pretragu (gost bez naloga); ranija verzija
// ovog kontrolera zahtevala je JwtAuthGuard, što je bilo neusklađeno sa tim zahtevom —
// isti princip kao M2 PublicProductsController (poglavlje 5.1: identitet dobavljača se
// ionako nikad ne izlaže ka B2C/B2B, nema osetljivog podatka koji bi guard štitio ovde).
@ApiTags('sales-search')
@Controller('sales/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@Query() query: SearchQueryDto) {
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
    });
  }
}
