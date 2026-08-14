import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OmnisearchService } from './omnisearch.service';
import { OmnisearchQueryDto } from './dto/omnisearch-query.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M15 spec §6.5.4, §9, prefiks /api/v1/ai-orchestration. Namerno BEZ @RequirePermission —
// vidljivost rezultata se sprovodi UNUTAR servisa (M5/M2 dozvole se proveravaju po alatu, isti
// obrazac kao search.controller.ts §6.5.2 "nikad sopstveni širi pristup agenta").
@ApiTags('ai-orchestration-omnisearch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-orchestration/omnisearch')
export class OmnisearchController {
  constructor(private readonly omnisearch: OmnisearchService) {}

  @Post()
  search(@Body() dto: OmnisearchQueryDto, @CurrentUser() actor: { userId: string }, @Req() req: Request) {
    return this.omnisearch.search({
      query: dto.query,
      channel: dto.channel,
      actorUserId: actor.userId,
      ipAddress: req.ip ?? null,
    });
  }
}
