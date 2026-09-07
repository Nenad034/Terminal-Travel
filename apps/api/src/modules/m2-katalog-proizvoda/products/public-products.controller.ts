import { BadRequestException, Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LanguageCode, VisibleChannel } from '@prisma/client';
import { ProductsService } from './products.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * M2 spec §5.1 — javni kanal (buduće M7/M8/M9-gost). Bez autentikacije (isti nivo
 * pristupa kao javni sajt/portal) — pristup je sam po sebi već ograničen na
 * status=ACTIVE proizvode vidljive na traženom kanalu, i nikad ne vraća source_* polja
 * (ProductsService.findAllPublic/findOnePublic, poglavlje 5.1). Odvojen kontroler od
 * ProductsController (interni, M17) — razdvajanje na nivou rute je namerna zaštita:
 * pogrešno dodata @RequirePermission ovde ne bi mogla slučajno da izloži puna interna
 * polja jer ovaj kontroler ih fizički nikad ne učitava (serializer, ne guard).
 */
/**
 * M2 spec §8 (izlazni kriterijum, dopuna 3.9.2026) — `channel` je OBAVEZAN i mora biti jedna
 * od tri vrednosti `VisibleChannel`; `lang` je opcion ali, kad je dat, mora biti podržan jezik.
 *
 * Do 3.9.2026 oba parametra su bila samo OTKUCANA (`channel: VisibleChannel`), bez ijedne
 * provere u vreme izvršavanja — TypeScript tip ne postoji posle kompajliranja, a globalni
 * `ValidationPipe` proverava DTO klase (telo zahteva), ne gole `@Query` argumente. Neproverena
 * vrednost je išla pravo u Prisma upit (`visibleChannels: { has: undefined }`) i pucala kao
 * `500 Internal server error` — na JEDINOM endpointu u sistemu koji radi bez prijave, dakle
 * tamo gde poruka o grešci jedina objašnjava spoljnom integratoru šta je pogrešio.
 * Vidi zamku 13.1 u docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md.
 *
 * Provera je pipe na parametru, ne `if` u servisu: servis ne sme da zna za HTTP statuse, a
 * `findAllPublic`/`findOnePublic` zovu i drugi (M15 omnisearch) sa već proverenom vrednošću.
 */
const CHANNEL_PIPE = new ParseEnumPipe(VisibleChannel, {
  exceptionFactory: () =>
    new BadRequestException(
      `Parametar "channel" je obavezan i mora biti jedna od vrednosti: ${Object.values(VisibleChannel).join(', ')}.`,
    ),
});

const LANG_PIPE = new ParseEnumPipe(LanguageCode, {
  optional: true,
  exceptionFactory: () =>
    new BadRequestException(
      `Parametar "lang" mora biti jedan od podržanih jezika: ${Object.values(LanguageCode).join(', ')}.`,
    ),
});

@ApiTags('catalog-public')
@Public()
@Controller('catalog/public/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(
    @Query('channel', CHANNEL_PIPE) channel: VisibleChannel,
    @Query('lang', LANG_PIPE) lang?: LanguageCode,
  ) {
    return this.products.findAllPublic(channel, lang);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('channel', CHANNEL_PIPE) channel: VisibleChannel,
    @Query('lang', LANG_PIPE) lang?: LanguageCode,
  ) {
    return this.products.findOnePublic(id, channel, lang);
  }
}
