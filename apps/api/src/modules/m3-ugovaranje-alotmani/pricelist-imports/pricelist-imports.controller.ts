import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricelistImportsService } from './pricelist-imports.service';
import { PricelistExtractionService } from './pricelist-extraction.service';
import { CreatePricelistImportDto } from './dto/create-pricelist-import.dto';
import { PrimeniUvozDto } from './dto/primeni-uvoz.dto';
import { PoklopiTipoveSobaDto } from './dto/poklopi-tipove-soba.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';
import {
  MAX_VELICINA_FAJLA,
  PODRZANE_EKSTENZIJE,
  PRICELIST_STORAGE_ENV,
  ensurePricelistUploadDir,
  formatIzImena,
  imeNaDisku,
} from './pricelist-storage';

// M3 spec §6/§7, prefiks /api/v1/contracting
@ApiTags('contracting-pricelist-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
@Controller('contracting/pricelist-imports')
export class PricelistImportsController {
  constructor(
    private readonly imports: PricelistImportsService,
    private readonly extraction: PricelistExtractionService,
  ) {}

  @Get()
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  findAll() {
    return this.imports.findAll();
  }

  @Post()
  @RequirePermission('M3', 'pricelist-import', 'CREATE')
  create(@Body() dto: CreatePricelistImportDto, @CurrentUser() actor: { userId: string }) {
    return this.imports.create(dto, actor.userId);
  }

  /**
   * §4.2.6 — pokretanje AI ekstrakcije. Odvojeno od `POST /pricelist-imports` namerno: uvoz je
   * zapis koji nastaje odmah, a ekstrakcija je poziv jezičkom modelu koji traje i može da ne
   * uspe. Da su spojeni, neuspeh modela bi značio da uvoz uopšte ne nastane, pa se ne bi videlo
   * ni šta je pokušano ni zašto nije uspelo.
   *
   * Dozvola je `CREATE`, ne `APPROVE_ROW`: ekstrakcija ništa ne upisuje u cenovnik (§4.2.4),
   * samo priprema redove za pregled.
   */
  @Post(':id/extract')
  @RequirePermission('M3', 'pricelist-import', 'CREATE')
  @AgentAction('M3', 'pricelist_import.extract')
  extract(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.extraction.extract(id, actor.userId);
  }

  @Post(':id/retry')
  @RequirePermission('M3', 'pricelist-import', 'CREATE')
  @AgentAction('M3', 'pricelist_import.extract')
  retry(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.extraction.retry(id, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id);
  }

  /**
   * §4.2.7 (v1.36) — ucitavanje fajla, ravnopravan ulaz sa nalepljenim tekstom.
   *
   * Fajl se pise DIREKTNO na disk (`diskStorage`), ne u memoriju: cenovnik od 25 MB u memoriji
   * po zahtevu je nepotreban trosak kad ionako mora da zavrsi na disku. Suprotno od M15
   * omnisearch-a, gde je prilog tranzientan i namerno se nikad ne pise.
   *
   * Velicina i tip se odbijaju OVDE, pre nego sto se ista upise i pre poziva modelu — poruka
   * koja stigne posle poziva je i skuplja i nerazumljivija (§4.2.7).
   */
  @Post('upload')
  @RequirePermission('M3', 'pricelist-import', 'CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        // `process.env`, ne `ConfigService`: interceptor se pravi pri ucitavanju klase, pre
        // nego sto DI kontejner postoji. @nestjs/config ionako upisuje `.env` u `process.env`.
        destination: (_req, _file, cb) =>
          cb(null, ensurePricelistUploadDir(process.env[PRICELIST_STORAGE_ENV])),
        filename: (_req, file, cb) => cb(null, imeNaDisku(file.originalname)),
      }),
      limits: { fileSize: MAX_VELICINA_FAJLA },
      fileFilter: (_req, file, cb) => {
        if (!formatIzImena(file.originalname)) {
          return cb(
            new BadRequestException(
              `Tip fajla nije podržan. Podržano: ${PODRZANE_EKSTENZIJE.join(', ')}.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Body('supplierId') supplierId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: { userId: string },
  ) {
    if (!file) throw new BadRequestException('Nijedan fajl nije poslat (polje "file").');
    const format = formatIzImena(file.originalname);
    if (!format) throw new BadRequestException('Tip fajla nije podržan.');
    return this.imports.create(
      {
        supplierId,
        // Putanja se cuva RELATIVNA na `PRICELIST_STORAGE_DIR` (§4.2.7): apsolutna putanja bi
        // vezala zapis za jednu masinu, a folder se po odluci vlasnika kasnije seli.
        sourceFileUrl: file.filename,
        sourceFileName: file.originalname,
        sourceFormat: format,
      },
      actor.userId,
    );
  }

  @Get(':id/rows')
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  listRows(@Param('id') id: string) {
    return this.imports.listRows(id);
  }

  /**
   * §4.2.10 (v1.39) — razlike uvoza prema zatečenom cenovniku, grupisane po ugovoru.
   *
   * Ovo je zamena za potvrdu reda po red: čovek potvrđuje **razlike**, ne redove. Dozvola je
   * `VIEW` jer se ništa ne upisuje (§2.11l, pravilo 2).
   */
  @Get(':id/razlike')
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  razlike(@Param('id') id: string) {
    return this.imports.razlike(id);
  }

  /**
   * §4.2.10 — primena potvrđenih razlika za JEDAN ugovor, kroz isti `primeni` put koji koristi
   * i izmena rečima. Dozvola je `APPROVE_ROW` — ovde cena postaje aktivna (§4.2.4).
   */
  @Post(':id/ugovori/:contractId/primeni')
  @RequirePermission('M3', 'pricelist-import', 'APPROVE_ROW')
  primeni(
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() dto: PrimeniUvozDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.primeniZaUgovor(id, contractId, dto, actor.userId);
  }

  /**
   * §2.11m — čovek bira tip sobe iz kataloga za tekst koji automatsko poklapanje nije razrešilo.
   * Dozvola je `APPROVE_ROW`, ista kao primena: ovo je odluka koja određuje šta će u cenovniku
   * stajati kao tip sobe, i time da li će prodaja tu sobu uopšte prepoznati.
   */
  @Post(':id/tipovi-soba')
  @RequirePermission('M3', 'pricelist-import', 'APPROVE_ROW')
  poklopiTipoveSoba(
    @Param('id') id: string,
    @Body() dto: PoklopiTipoveSobaDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.poklopiTipoveSobaUvoza(id, dto.mapiranja, actor.userId);
  }

  @Post(':id/rows/:rowId/reject')
  @RequirePermission('M3', 'pricelist-import', 'APPROVE_ROW')
  reject(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.odbijRed(id, rowId, actor.userId);
  }
}
