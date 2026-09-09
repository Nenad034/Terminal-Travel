import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricelistVersionsService } from './pricelist-versions.service';
import { PotvrdiVerzijuDto } from './dto/potvrdi-verziju.dto';
import { PredlogCenovnikaDto } from './dto/predlog-cenovnika.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * M3 spec §2.11l — verzije cenovnika, prefiks /api/v1/contracting.
 *
 * Dozvole su iste kao za ostatak cenovnika (`M3/contract-period`): ko sme da menja cene sme i
 * da potvrdi verziju, jer je verzija zapis o tim istim izmenama. Nova dozvola bi tražila dodelu
 * po korisniku za posao koji je isti (ista odluka kao kod sezona u `PricelistController`).
 */
@ApiTags('contracting-pricelist-versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracting')
export class PricelistVersionsController {
  constructor(private readonly verzije: PricelistVersionsService) {}

  /** Sve verzije cenovnika jednog ugovora, najnovija prva. */
  @Get('contracts/:contractId/pricelist-versions')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  list(@Param('contractId') contractId: string) {
    return this.verzije.listVersions(contractId);
  }

  /**
   * Razlike živog cenovnika prema poslednjoj potvrđenoj verziji — ekran „šta se promenilo".
   *
   * Stoji PRE rute sa `:versionNo` jer bi je inače ta ruta progutala kao broj verzije.
   */
  @Get('contracts/:contractId/pricelist-versions/razlike')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  razlike(@Param('contractId') contractId: string) {
    return this.verzije.razlikeUOdnosuNaPoslednju(contractId);
  }

  /** Jedna verzija sa celim snimkom — ostaje čitljiva i posle novih verzija. */
  @Get('contracts/:contractId/pricelist-versions/:versionNo')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  jedna(
    @Param('contractId') contractId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ) {
    return this.verzije.getVersion(contractId, versionNo);
  }

  /** Razlike te verzije prema onoj pre nje. */
  @Get('contracts/:contractId/pricelist-versions/:versionNo/diff')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  diff(
    @Param('contractId') contractId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ) {
    return this.verzije.diffVerzije(contractId, versionNo);
  }

  /** Ručni tok: snimi trenutno stanje cenovnika kao novu verziju. */
  @Post('contracts/:contractId/pricelist-versions')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  potvrdi(
    @Param('contractId') contractId: string,
    @Body() dto: PotvrdiVerzijuDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.verzije.potvrdi(contractId, dto, actor.userId);
  }

  /** Predlog spolja (§4.2/§4.8): vraća samo razlike, **ništa ne upisuje**. */
  @Post('contracts/:contractId/pricelist-versions/predlog')
  @RequirePermission('M3', 'contract-period', 'VIEW')
  predlozi(@Param('contractId') contractId: string, @Body() dto: PredlogCenovnikaDto) {
    return this.verzije.predlozi(contractId, dto);
  }

  /** Primena predloga — isključivo razlike koje je čovek potvrdio. */
  @Post('contracts/:contractId/pricelist-versions/primeni')
  @RequirePermission('M3', 'contract-period', 'EDIT')
  primeni(
    @Param('contractId') contractId: string,
    @Body() dto: PredlogCenovnikaDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.verzije.primeni(contractId, dto, actor.userId);
  }
}
