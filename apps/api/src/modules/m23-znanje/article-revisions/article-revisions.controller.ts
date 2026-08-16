import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArticleRevisionsService } from './article-revisions.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M23 spec §8, POST /articles/:id/revisions/:revisionId/approve|reject.
@ApiTags('knowledge-article-revisions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/articles/:articleId/revisions')
export class ArticleRevisionsController {
  constructor(private readonly revisions: ArticleRevisionsService) {}

  @Get()
  @RequirePermission('M23', 'article', 'VIEW')
  findAll(@Param('articleId') articleId: string) {
    return this.revisions.findAll(articleId);
  }

  @Post(':revisionId/approve')
  @RequirePermission('M23', 'article-revision', 'APPROVE')
  approve(@Param('articleId') articleId: string, @Param('revisionId') revisionId: string, @CurrentUser() actor: { userId: string }) {
    return this.revisions.approve(articleId, revisionId, actor.userId);
  }

  @Post(':revisionId/reject')
  @RequirePermission('M23', 'article-revision', 'APPROVE')
  reject(@Param('articleId') articleId: string, @Param('revisionId') revisionId: string, @CurrentUser() actor: { userId: string }) {
    return this.revisions.reject(articleId, revisionId, actor.userId);
  }
}
