import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { OmnisearchService } from './omnisearch.service';
import { OmnisearchQueryDto } from './dto/omnisearch-query.dto';
import { AccessTokenPayload } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';

// M15 spec §6.5.4, §9, prefiks /api/v1/ai-orchestration. Namerno BEZ @RequirePermission —
// vidljivost rezultata se sprovodi UNUTAR servisa (M5/M2 dozvole se proveravaju po alatu, isti
// obrazac kao search.controller.ts §6.5.2 "nikad sopstveni širi pristup agenta").
//
// Dopuna avgust 2026 (M8 §3a): `channel = INTERNAL_PANEL` I DALJE zahteva prijavu (M17 tim) —
// `channel = B2C_SITE` radi anonimno (M8 §3a, "radi anonimno, isti princip kao poglavlje 3
// korak 1"), pa je blanket `@UseGuards(JwtAuthGuard)` zamenjen ručnom, po-kanalu proverom, isti
// obrazac kao M5 SearchController (§11 dopuna) — jedino mesto koje je već rešavalo tačno ovaj
// problem (javan endpoint sa jednim kanalom koji ipak mora ostati autentifikovan).
@ApiTags('ai-orchestration-omnisearch')
@Controller('ai-orchestration/omnisearch')
export class OmnisearchController {
  constructor(
    private readonly omnisearch: OmnisearchService,
    private readonly jwt: JwtService,
  ) {}

  @Post()
  async search(@Body() dto: OmnisearchQueryDto, @Req() req: Request) {
    const actorUserId = await this.resolveActor(dto.channel, req);
    return this.omnisearch.search({
      query: dto.query,
      channel: dto.channel,
      actorUserId,
      lang: dto.lang,
      pageContent: dto.pageContent,
      contextItems: dto.contextItems,
      history: dto.history,
      ipAddress: req.ip ?? null,
    });
  }

  /**
   * INTERNAL_PANEL — nepromenjeno ponašanje, JWT je obavezan (nevažeći/nedostajući token = 401),
   * isti obrazac kao ranije @UseGuards(JwtAuthGuard). B2C_SITE — token je opcion: prisutan i
   * važeći token identifikuje prijavljenog gosta (za sopstvene rezervacije u rezultatima),
   * odsutan token = anoniman posetilac (actorUserId = null), NIKAD izmišljen identitet.
   */
  private async resolveActor(channel: 'INTERNAL_PANEL' | 'B2C_SITE', req: Request): Promise<string | null> {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (channel === 'INTERNAL_PANEL') {
      if (!token) throw new UnauthorizedException('channel=INTERNAL_PANEL zahteva prijavu (Bearer token).');
      try {
        return this.jwt.verify<AccessTokenPayload>(token).sub;
      } catch {
        throw new UnauthorizedException('Nevažeći ili istekao token.');
      }
    }

    if (!token) return null;
    try {
      return this.jwt.verify<AccessTokenPayload>(token).sub;
    } catch {
      return null; // istekao/nevažeći token na anonimnom kanalu — tretiraj kao anoniman posetilac, ne grešku
    }
  }
}
