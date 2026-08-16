import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArticleSourcesService } from './article-sources.service';
import { ProposeSourceDto } from './dto/propose-source.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M23 spec §8, GET/POST /articles/:id/sources, POST /articles/:id/sources/:sourceId/approve.
@ApiTags('knowledge-article-sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/articles/:articleId/sources')
export class ArticleSourcesController {
  constructor(private readonly sources: ArticleSourcesService) {}

  @Get()
  @RequirePermission('M23', 'article', 'VIEW')
  findAll(@Param('articleId') articleId: string) {
    return this.sources.findAll(articleId);
  }

  @Post()
  @RequirePermission('M23', 'article', 'EDIT')
  propose(@Param('articleId') articleId: string, @Body() dto: ProposeSourceDto, @CurrentUser() actor: { userId: string }) {
    return this.sources.propose(articleId, dto, actor.userId);
  }

  @Post(':sourceId/approve')
  @RequirePermission('M23', 'article-source', 'APPROVE')
  approve(@Param('articleId') articleId: string, @Param('sourceId') sourceId: string, @CurrentUser() actor: { userId: string }) {
    return this.sources.approve(articleId, sourceId, actor.userId);
  }

  @Post(':sourceId/reject')
  @RequirePermission('M23', 'article-source', 'APPROVE')
  reject(@Param('articleId') articleId: string, @Param('sourceId') sourceId: string, @CurrentUser() actor: { userId: string }) {
    return this.sources.reject(articleId, sourceId, actor.userId);
  }
}
