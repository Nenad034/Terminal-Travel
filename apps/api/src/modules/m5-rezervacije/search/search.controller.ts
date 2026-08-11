import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

// M5 spec §11, prefiks /api/v1/sales — pretraga je dostupna svakom autentifikovanom
// pozivaocu (interni tim, B2B portal, gost na sajtu preko M8/M9), bez posebne dozvole
// (isti princip kao M4 interni operativni pozivi — samo JwtAuthGuard).
@ApiTags('sales-search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
