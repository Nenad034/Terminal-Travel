import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LanguageCode } from '@prisma/client';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';

// M23 spec §8, prefiks /api/v1/knowledge. VIEW dozvola je jedini gate za GET rute (§3.1 — ista
// puna lista za interni tim i SUBAGENT_ADMIN, bez audience razdvajanja poput M21); EDIT dozvola
// dodatno otključava DRAFT/PENDING_APPROVAL/ARCHIVED status na GET (uređivač vidi sve).
@ApiTags('knowledge-articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/articles')
export class ArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  @RequirePermission('M23', 'article', 'VIEW')
  async findAll(@CurrentUser() actor: { userId: string }, @Query('lang') lang?: LanguageCode) {
    const canSeeAllStatuses = await this.permissions.hasPermission(actor.userId, 'M23', 'article', 'EDIT');
    return this.articles.findAll(actor.userId, canSeeAllStatuses, lang);
  }

  @Post()
  @RequirePermission('M23', 'article', 'EDIT')
  create(@Body() dto: CreateArticleDto, @CurrentUser() actor: { userId: string }) {
    return this.articles.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M23', 'article', 'VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }, @Query('lang') lang?: LanguageCode) {
    const canSeeAllStatuses = await this.permissions.hasPermission(actor.userId, 'M23', 'article', 'EDIT');
    return this.articles.findOne(id, actor.userId, canSeeAllStatuses, lang);
  }

  @Patch(':id')
  @RequirePermission('M23', 'article', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto, @CurrentUser() actor: { userId: string }) {
    return this.articles.update(id, dto, actor.userId);
  }

  @Post(':id/publish')
  @RequirePermission('M23', 'article', 'PUBLISH')
  publish(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.articles.publish(id, actor.userId);
  }
}
